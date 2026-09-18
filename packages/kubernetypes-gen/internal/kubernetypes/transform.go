package kubernetypes

import (
	"fmt"
	"kubernetypes-gen/internal/crdextra"
	"slices"

	"golang.org/x/tools/go/packages"
	"sigs.k8s.io/controller-tools/pkg/crd"
	crdmarkers "sigs.k8s.io/controller-tools/pkg/crd/markers"
	"sigs.k8s.io/controller-tools/pkg/loader"
	"sigs.k8s.io/controller-tools/pkg/markers"
)

type TransformInput struct {
	Entry            map[string]string `json:"entry"`
	LoaderDir        string            `json:"loaderDir"`
	ImportResolve    map[string]string `json:"importResolve"`
	TypeOverrides    map[string]*Type  `json:"typeOverrides"`
	TypeReplacements map[string]*Type  `json:"typeReplacements"`
}

type TransformOutput struct {
	Bundles []*Bundle `json:"bundles,omitempty"`
}

func Transform(input *TransformInput) (*TransformOutput, error) {
	var pkgPaths []string

	pkgPathToDtsFile := make(map[string]string)
	for dtsFile, pkgPath := range input.Entry {
		pkgPaths = append(pkgPaths, pkgPath)
		pkgPathToDtsFile[pkgPath] = dtsFile
	}

	cfg := &packages.Config{
		Dir: input.LoaderDir,
		//Mode: packages.NeedName |
		//	packages.NeedFiles |
		//	packages.NeedCompiledGoFiles |
		//	packages.NeedImports |
		//	packages.NeedDeps |
		//	packages.NeedTypes |
		//	packages.NeedTypesInfo |
		//	packages.NeedSyntax,
	}

	roots, err := loader.LoadRootsWithConfig(cfg, pkgPaths...)
	if err != nil {
		return nil, err
	}

	registry := &markers.Registry{}
	if err = crdmarkers.Register(registry); err != nil {
		return nil, err
	}
	if err = registry.Define("enum", markers.DescribesType, struct{}{}); err != nil {
		return nil, err
	}

	parser := &crd.Parser{
		Collector: &markers.Collector{Registry: registry},
		Checker:   &loader.TypeChecker{},
	}
	extraParser := &crdextra.Parser{}

	for _, pkg := range roots {
		parser.NeedPackage(pkg)
		extraParser.NeedPackage(pkg)
	}

	pkgPresent := make(map[string]bool)
	pkgTypes := make(map[*loader.Package][]*markers.TypeInfo)
	for typeIdent, typeInfo := range parser.Types {
		pkgTypes[typeIdent.Package] = append(pkgTypes[typeIdent.Package], typeInfo)
		pkgPresent[typeIdent.Package.PkgPath] = true
	}

	for _, pkgPath := range input.Entry {
		if _, ok := pkgPresent[pkgPath]; !ok {
			return nil, fmt.Errorf("package %q present in entry but could not be resolved by go tool", pkgPath)
		}
	}

	var bundles []*Bundle
	for pkg, typeInfos := range pkgTypes {
		declBuilder, err := newDeclarationBuilder(parser, extraParser, input, pkg)
		if err != nil {
			return nil, err
		}

		declarations := make([]*Declaration, len(typeInfos))
		for i, typeInfo := range typeInfos {
			declarations[i] = declBuilder.Build(typeInfo)
		}
		slices.SortStableFunc(declarations, declarationCmp)

		imports, err := declBuilder.Imports()
		if err != nil {
			return nil, err
		}

		bundles = append(bundles, &Bundle{
			File:         pkgPathToDtsFile[pkg.PkgPath],
			Imports:      imports,
			Declarations: declarations,
		})
	}
	slices.SortStableFunc(bundles, bundleCmp)

	return &TransformOutput{bundles}, nil
}
