package kubernetypes

import (
	"fmt"
	"go/ast"
	"go/types"
	"kubernetypes-gen/internal/crdextra"
	"maps"
	"slices"
	"strings"

	"k8s.io/apimachinery/pkg/runtime/schema"
	"sigs.k8s.io/controller-tools/pkg/crd"
	crdmarkers "sigs.k8s.io/controller-tools/pkg/crd/markers"
	"sigs.k8s.io/controller-tools/pkg/loader"
	"sigs.k8s.io/controller-tools/pkg/markers"
)

type Declaration struct {
	Name           string                      `json:"name"`
	Description    string                      `json:"description,omitempty"`
	Exported       bool                        `json:"exported"`
	TypeParameters []*TypeParameterDeclaration `json:"typeParameters,omitempty"`
	Type           *Type                       `json:"type"`
}

func declarationCmp(a, b *Declaration) int {
	return strings.Compare(a.Name, b.Name)
}

type TypeParameterDeclaration struct {
	Name       string `json:"name"`
	Constraint *Type  `json:"constraint,omitempty"`
	Default    *Type  `json:"default,omitempty"`
}

type declarationBuilder struct {
	pkg               *loader.Package
	apiVersion        string
	markersInPkg      map[ast.Node]markers.MarkerValues
	enumValues        map[crdextra.TypeIdent][]string
	importResolve     map[string]string
	typeOverrides     map[string]*Type
	typeReplacements  map[string]*Type
	defaultOptional   bool
	imports           map[string]*BundleImport
	unresolvedImports []string
}

func newDeclarationBuilder(parser *crd.Parser, enumParser *crdextra.Parser, transformInput *TransformInput, pkg *loader.Package) (*declarationBuilder, error) {
	pkgMarkers, err := markers.PackageMarkers(parser.Collector, pkg)
	if err != nil {
		return nil, err
	}

	markersInPkg, err := parser.Collector.MarkersInPackage(pkg)
	if err != nil {
		return nil, err
	}

	gv := schema.GroupVersion{Group: apiGroupFromPkg(pkg), Version: pkg.Name}
	if apiGroupMarker, ok := pkgMarkers.Get("groupName").(string); ok {
		gv.Group = apiGroupMarker
	}
	if apiVersionMarker, ok := pkgMarkers.Get("versionName").(string); ok {
		gv.Version = apiVersionMarker
	}

	pkgDefaultOptional := false
	if pkgMarkers.Get("kubebuilder:validation:Optional") != nil {
		pkgDefaultOptional = true
	}

	return &declarationBuilder{
		pkg:              pkg,
		apiVersion:       gv.String(),
		markersInPkg:     markersInPkg,
		enumValues:       enumParser.EnumValues,
		importResolve:    transformInput.ImportResolve,
		typeOverrides:    transformInput.TypeOverrides,
		typeReplacements: transformInput.TypeReplacements,
		defaultOptional:  pkgDefaultOptional,
		imports:          make(map[string]*BundleImport),
	}, nil
}

func (b *declarationBuilder) Imports() ([]*BundleImport, error) {
	if len(b.unresolvedImports) > 0 {
		return nil, fmt.Errorf("can't resolve imports:\n%s", strings.Join(b.unresolvedImports, "\n"))
	}

	imports := slices.Collect(maps.Values(b.imports))
	slices.SortStableFunc(imports, bundleImportCmp)
	return imports, nil
}

func (b *declarationBuilder) Build(typeInfo *markers.TypeInfo) *Declaration {
	var typ *Type

	if typeOverride, ok := b.typeOverrides[b.pkg.PkgPath+"."+typeInfo.Name]; ok {
		typ = typeOverride
	} else {
		typ = b.postprocessType(typeInfo, b.buildType(typeInfo.RawSpec.Type))
	}

	var typeParameters []*TypeParameterDeclaration
	if b.pkg.PkgPath == "k8s.io/apimachinery/pkg/apis/meta/v1" && typeInfo.Name == "TypeMeta" {
		typeParameters = []*TypeParameterDeclaration{
			{Name: "ApiVersion", Constraint: stringType, Default: stringType},
			{Name: "Kind", Constraint: stringType, Default: stringType},
		}
	}

	return &Declaration{
		Name:           typeInfo.Name,
		Description:    commentToDescription(typeInfo.RawDecl.Doc),
		Exported:       ast.IsExported(typeInfo.Name),
		TypeParameters: typeParameters,
		Type:           typ,
	}
}

func (b *declarationBuilder) buildType(node ast.Expr) *Type {
	switch typeNode := node.(type) {
	case *ast.Ident, *ast.SelectorExpr:
		switch typ := b.pkg.TypesInfo.TypeOf(typeNode).(type) {
		case *types.Basic:
			if typ.Kind() == types.Invalid {
				b.unresolvedImports = append(b.unresolvedImports, "* "+types.ExprString(typeNode)+" in "+b.pkg.PkgPath)
			}
			return b.buildBasicType(typ)
		case *types.Named:
			return b.buildNamedType(typ)
		default:
			return unknownType
		}
	case *ast.ParenExpr:
		return b.buildType(typeNode.X)
	case *ast.StarExpr:
		return b.buildType(typeNode.X)
	case *ast.StructType:
		return b.buildStructType(typeNode.Fields.List)
	case *ast.ArrayType:
		return arrayType(b.buildType(typeNode.Elt))
	case *ast.MapType:
		return objectLiteralType(nil, &IndexSignature{
			Key: b.buildType(typeNode.Key),
			Val: b.buildType(typeNode.Value),
		})
	case *ast.InterfaceType:
		return b.buildInterfaceType(typeNode.Methods.List)
	case *ast.FuncType:
		return functionType
	default:
		return unknownType
	}
}

func (b *declarationBuilder) buildBasicType(typ *types.Basic) *Type {
	switch typ.Kind() {
	case types.Int, types.Int8, types.Int16, types.Int32, types.Int64,
		types.Uint8, types.Uint16, types.Uint32, types.Uint64,
		types.Float32, types.Float64, types.UntypedInt, types.UntypedFloat:
		return numberType
	case types.String, types.UntypedString:
		return stringType
	case types.Bool, types.UntypedBool:
		return booleanType
	default:
		return unknownType
	}
}

func (b *declarationBuilder) buildNamedType(typ *types.Named) *Type {
	typName := typ.Obj()
	pkgPath := typName.Pkg().Path()
	if pkgPath == b.pkg.PkgPath {
		return referenceType(pkgPath, typName.Name(), "")
	}
	if typeReplacement, ok := b.typeReplacements[pkgPath+"."+typName.Name()]; ok {
		return typeReplacement
	}
	return referenceType(pkgPath, typName.Name(), b.resolveImportNamespace(pkgPath))
}

func (b *declarationBuilder) buildStructType(fields []*ast.Field) *Type {
	var props []*ObjectProperty
	var embeddedTypes []*Type

	for _, field := range fields {
		if field.Tag == nil {
			continue
		}
		jsonTag, hasJsonTag := loader.ParseAstTag(field.Tag).Lookup("json")
		if !hasJsonTag {
			continue
		}
		jsonOpts := strings.Split(jsonTag, ",")
		if len(jsonOpts) == 1 && jsonOpts[0] == "-" {
			continue
		}
		inline, omitEmpty := false, false
		for _, opt := range jsonOpts[1:] {
			switch opt {
			case "inline":
				inline = true
			case "omitempty":
				omitEmpty = true
			}
		}
		name := jsonOpts[0]
		typ := b.buildType(field.Type)

		if name == "" {
			embeddedTypes = append(embeddedTypes, typ)
			continue
		}

		fieldMarkers := b.markersInPkg[field]
		optional := b.defaultOptional

		switch {
		case fieldMarkers.Get("optional") != nil,
			fieldMarkers.Get("k8s:optional") != nil,
			fieldMarkers.Get("kubebuilder:validation:Optional") != nil:
			optional = true
		case fieldMarkers.Get("required") != nil,
			fieldMarkers.Get("k8s:required") != nil,
			fieldMarkers.Get("kubebuilder:validation:Required") != nil:
			optional = false
		case b.defaultOptional == false:
			optional = inline || omitEmpty
		}

		enumMarker := fieldMarkers.Get("kubebuilder:validation:Enum")
		if enumMarker != nil && typ.Kind == "string" {
			if enum, ok := enumMarker.(crdmarkers.Enum); ok {
				var unionElements []*Type
				for _, val := range enum {
					if strVal, isStrVal := val.(string); isStrVal {
						unionElements = append(unionElements, stringLiteralType(strVal))
					}
				}
				if len(unionElements) == len(enum) {
					typ = unionType(unionElements)
				}
			}
		}

		props = append(props, &ObjectProperty{
			Name:        name,
			Description: commentToDescription(field.Doc),
			Optional:    optional,
			Type:        typ,
		})
	}

	slices.SortStableFunc(props, objectPropertyCmp)

	typ := objectLiteralType(props, nil)
	if len(embeddedTypes) > 0 {
		embeddedTypes = append(embeddedTypes, typ)
		return intersectionType(embeddedTypes)
	}
	return typ
}

func (b *declarationBuilder) buildInterfaceType(fields []*ast.Field) *Type {
	methods := make([]*InterfaceMethod, len(fields))
	for i, field := range fields {
		if len(field.Names) > 0 {
			methods[i] = &InterfaceMethod{Name: field.Names[0].Name}
		} else {
			methods[i] = &InterfaceMethod{Name: types.ExprString(field.Type), Embedded: true}
		}
	}
	slices.SortStableFunc(methods, interfaceMethodCmp)
	return interfaceType(methods)
}

func (b *declarationBuilder) postprocessType(typeInfo *markers.TypeInfo, typ *Type) *Type {
	switch typ.Kind {
	case "object-literal":
		if b.pkg.PkgPath == "k8s.io/apimachinery/pkg/apis/meta/v1" && typeInfo.Name == "TypeMeta" {
			for _, prop := range typ.Props {
				if prop.Name == "apiVersion" {
					prop.Optional = false
					prop.Type = referenceType("", "ApiVersion", "")
				}
				if prop.Name == "kind" {
					prop.Optional = false
					prop.Type = referenceType("", "Kind", "")
				}
			}
		}
	case "intersection":
		for _, el := range typ.Elements {
			if el.Kind == "reference" && el.Pkg == "k8s.io/apimachinery/pkg/apis/meta/v1" && el.Name == "TypeMeta" {
				el.Params = []*Type{
					stringLiteralType(b.apiVersion),
					stringLiteralType(typeInfo.Name),
				}
			}
		}
	case "string":
		if enumValues, ok := b.enumValues[crdextra.TypeIdent{PkgPath: b.pkg.PkgPath, Name: typeInfo.Name}]; ok {
			slices.Sort(enumValues)
			unionElements := make([]*Type, len(enumValues))
			for i, enumValue := range enumValues {
				unionElements[i] = stringLiteralType(enumValue)
			}
			if typeInfo.Markers.Get("enum") == nil {
				unionElements = append(unionElements, intersectionType([]*Type{stringType, nonNullType}))
			}
			return unionType(unionElements)
		}
	}
	return typ
}

func (b *declarationBuilder) resolveImportNamespace(pkgPath string) string {
	if imp, ok := b.imports[pkgPath]; ok {
		return imp.As
	}
	from, ok := b.importResolve[pkgPath]
	if !ok {
		b.unresolvedImports = append(b.unresolvedImports, "* "+pkgPath+" (in "+b.pkg.PkgPath+")")
	}
	imp := &BundleImport{
		As:   fmt.Sprintf("m%d", len(b.imports)),
		From: from,
	}
	b.imports[pkgPath] = imp
	return imp.As
}

func apiGroupFromPkg(pkg *loader.Package) string {
	pkgPathSegments := strings.Split(pkg.PkgPath, "/")
	if n := len(pkgPathSegments); n > 1 {
		return pkgPathSegments[n-2]
	}
	return ""
}

func commentToDescription(cg *ast.CommentGroup) string {
	if cg == nil {
		return ""
	}
	inLines := strings.Split(cg.Text(), "\n")
	var outLines []string
	for _, line := range inLines {
		if !strings.HasPrefix(line, "+") {
			outLines = append(outLines, line)
		}
	}
	return strings.TrimSpace(strings.Join(outLines, "\n"))
}
