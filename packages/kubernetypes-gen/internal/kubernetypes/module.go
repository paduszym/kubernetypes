package kubernetypes

import "strings"

type Bundle struct {
	File         string          `json:"file"`
	Imports      []*BundleImport `json:"imports,omitempty"`
	Declarations []*Declaration  `json:"declarations,omitempty"`
}

func bundleCmp(a, b *Bundle) int {
	return strings.Compare(a.File, b.File)
}

type BundleImport struct {
	As   string `json:"as"`
	From string `json:"from"`
}

func bundleImportCmp(a, b *BundleImport) int {
	return strings.Compare(a.From, b.From)
}
