package crdextra

import (
	"go/ast"
	"go/token"
	"go/types"
	"strconv"

	"sigs.k8s.io/controller-tools/pkg/loader"
)

type Parser struct {
	EnumValues map[TypeIdent][]string
}

func (p *Parser) NeedPackage(pkg *loader.Package) {
	if p.EnumValues == nil {
		p.EnumValues = make(map[TypeIdent][]string)
	}
	for _, file := range pkg.Syntax {
		for _, decl := range file.Decls {
			if genDecl, isGenDecl := decl.(*ast.GenDecl); isGenDecl {
				for _, spec := range genDecl.Specs {
					if valueSpec, isValueSpec := spec.(*ast.ValueSpec); isValueSpec {
						if len(valueSpec.Names) == 1 && len(valueSpec.Values) == 1 {
							p.needExpression(pkg, valueSpec.Values[0])
						}
					}
				}
			}
		}
	}
}

func (p *Parser) needExpression(pkg *loader.Package, expr ast.Expr) {
	typ := pkg.TypesInfo.TypeOf(expr)
	if named, isNamed := typ.(*types.Named); isNamed {
		if typPkg := named.Obj().Pkg(); typPkg != nil {
			typeIdent := TypeIdent{PkgPath: typPkg.Path(), Name: named.Obj().Name()}
			switch value := expr.(type) {
			case *ast.BasicLit:
				p.needLiteral(typeIdent, value)
			case *ast.CallExpr:
				if len(value.Args) == 1 {
					if basicLit, isBasicLit := value.Args[0].(*ast.BasicLit); isBasicLit {
						p.needLiteral(typeIdent, basicLit)
					}
				}
			}
		}
	}
}

func (p *Parser) needLiteral(typeIdent TypeIdent, basicLit *ast.BasicLit) {
	if basicLit.Kind == token.STRING {
		literal, _ := strconv.Unquote(basicLit.Value)
		p.EnumValues[typeIdent] = append(p.EnumValues[typeIdent], literal)
	}
}
