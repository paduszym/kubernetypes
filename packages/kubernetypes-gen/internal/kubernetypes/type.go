package kubernetypes

import (
	"encoding/json"
	"strings"
)

type Type struct {
	Kind string `json:"kind,omitempty"`
	// "kind": "reference"
	Pkg       string  `json:"-"`
	Namespace string  `json:"namespace,omitempty"`
	Name      string  `json:"name,omitempty"`
	Params    []*Type `json:"params,omitempty"`
	// "kind": "object"
	Props          []*ObjectProperty `json:"props,omitempty"`
	IndexSignature *IndexSignature   `json:"indexSignature,omitempty"`
	// "kind": "array"
	Element *Type `json:"element,omitempty"`
	// "kind": "intersection" / "union"
	Elements []*Type `json:"elements,omitempty"`
	// "kind": "string-literal"
	Raw string `json:"raw,omitempty"`
	// "kind": "interface"
	Methods []*InterfaceMethod `json:"methods,omitempty"`
}

type ObjectProperty struct {
	Name        string `json:"name"`
	Description string `json:"description,omitempty"`
	Optional    bool   `json:"optional"`
	Type        *Type  `json:"type"`
}

func objectPropertyCmp(a, b *ObjectProperty) int {
	return strings.Compare(a.Name, b.Name)
}

type IndexSignature struct {
	Key *Type `json:"key"`
	Val *Type `json:"val"`
}

type InterfaceMethod struct {
	Name     string `json:"name,omitempty"`
	Embedded bool   `json:"embedded"`
}

func interfaceMethodCmp(a, b *InterfaceMethod) int {
	return strings.Compare(a.Name, b.Name)
}

var (
	stringType   = &Type{Kind: "string"}
	numberType   = &Type{Kind: "number"}
	booleanType  = &Type{Kind: "boolean"}
	functionType = &Type{Kind: "function"}
	nonNullType  = &Type{Kind: "non-null"}
	unknownType  = &Type{Kind: "unknown"}
)

func referenceType(pkg string, name, namespace string) *Type {
	return &Type{Kind: "reference", Pkg: pkg, Name: name, Namespace: namespace}
}

func objectLiteralType(props []*ObjectProperty, indexSignature *IndexSignature) *Type {
	return &Type{Kind: "object-literal", Props: props, IndexSignature: indexSignature}
}

func arrayType(element *Type) *Type {
	return &Type{Kind: "array", Element: element}
}

func intersectionType(elements []*Type) *Type {
	return &Type{Kind: "intersection", Elements: elements}
}

func unionType(elements []*Type) *Type {
	return &Type{Kind: "union", Elements: elements}
}

func stringLiteralType(value string) *Type {
	raw, _ := json.Marshal(value)
	return &Type{Kind: "string-literal", Raw: string(raw)}
}

func interfaceType(methods []*InterfaceMethod) *Type {
	return &Type{Kind: "interface", Methods: methods}
}
