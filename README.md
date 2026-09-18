# kubernetypes

TypeScript types for Kubernetes APIs and Kubernetes-related projects, generated from Go source code.

## Packages

| Package                                                                        | Directory                                                            | Description                                                             |
| ------------------------------------------------------------------------------ | -------------------------------------------------------------------- | ----------------------------------------------------------------------- |
| [`kubernetypes`](https://www.npmjs.com/package/kubernetypes)                   | [`packages/kubernetypes`](./packages/kubernetypes)                   | Types for core Kubernetes APIs (`k8s.io/api`, `k8s.io/apimachinery`, …) |
| [`kubernetypes-gen`](https://www.npmjs.com/package/kubernetypes-gen)           | [`packages/kubernetypes-gen`](./packages/kubernetypes-gen)           | The generator that produces the packages                                |
| [`@kubernetypes/traefik`](https://www.npmjs.com/package/@kubernetypes/traefik) | [`packages/@kubernetypes/traefik`](./packages/@kubernetypes/traefik) | Types for Traefik Kubernetes CRDs                                       |

Generated package versions track the upstream Go modules: `kubernetypes` 1.35.0 corresponds to the Kubernetes v0.35.0 Go
modules, `@kubernetypes/traefik` 3.7.0 to Traefik v3.7.0 and so on.

## Using `kubernetypes-gen`

### Requirements

- Node `>= 24.11`
- Go toolchain available in `PATH` (or via `GOBIN` / `GOROOT`)
- TypeScript `>= 5.9.3` (peer dependency of `kubernetypes-gen`)

### 1. Define package exports

Each export subpath in the target package's `package.json` declares one generated file:

```json
{
  "name": "@kubernetypes/traefik",
  "type": "module",
  "exports": {
    "./api/traefikio/v1alpha1": {
      "types": "./dist/api/traefikio/v1alpha1.d.ts",
      "kubernetypes": "gopkg:github.com/traefik/traefik/v3/pkg/provider/kubernetes/crd/traefikio/v1alpha1"
    }
  }
}
```

- `types` — where the generated declaration file is written (relative to the package directory). This is what TypeScript
  consumers resolve.
- `kubernetypes` — a `gopkg:` prefix followed by the Go package import path to translate into that file. This condition
  is only used by the generator at build time.

Exports of dependency packages participate in import resolution too — `@kubernetypes/traefik` depends on `kubernetypes`,
so generated declarations can reference types like `kubernetypes/apimachinery/apis/meta/v1`.

### 2. Add `kubernetypes-gen.json`

The minimal config lists the Go modules providing the `gopkg:` packages:

```json
{
  "loaderGoMod": {
    "require": {
      "github.com/traefik/traefik/v3": "v3.7.0"
    }
  }
}
```

See the [reference](#kubernetypes-genjson-reference) below for all options.

### 3. Run the generator

```shell
npx kubernetypes-gen ./packages/@kubernetypes/traefik
```

Inside this monorepo:

```shell
npm run run:kubernetypes-gen -- ./packages/@kubernetypes/traefik
```

`.d.ts` files are written to the paths from the `types` conditions (typically under `dist/`). One exported type alias is
produced per Go type; Go doc comments become JSDoc, `deprecated:` notes become `@deprecated` tags, and
`+kubebuilder:validation:Enum` markers on string fields become string literal unions.

Simplified excerpt of generated output:

```ts
/**
 * IngressRouteSpec is a specification of an IngressRoute resource.
 */
export type IngressRouteSpec = {
  entryPoints?: string[];
  routes: IngressRoute[];
};
```

## `kubernetypes-gen.json` reference

```json
{
  "loaderGoMod": {
    "require": {
      "<go module>": "<version>"
    },
    "replace": {
      "<go module>": "<replacement>"
    }
  },
  "typeOverrides": {
    "<go package path>.<TypeName>": {
      "kind": "…"
    }
  },
  "typeReplacements": {
    "<go package path>.<TypeName>": {
      "kind": "…"
    }
  }
}
```

### `loaderGoMod`

The generator creates a temporary Go "loader" module that imports every `gopkg:` package from `exports` and type-checks
it, then analyzes the result.

- `loaderGoMod.require` — map of Go module path to version (as in `go get`). Every `gopkg:` package must be provided by
  one of these modules, directly or transitively. Keep these versions in sync with the package's own version.
- `loaderGoMod.replace` — optional map of Go module path to replacement, following standard `replace` semantics;
  relative targets are resolved against the package directory. Useful for packages that do not compile standalone — e.g.
  `@kubernetypes/traefik` replaces `github.com/traefik/traefik/dynamic/ext` with a small local stub in [
  `packages/@kubernetypes/traefik/dynamic-ext`](./packages/@kubernetypes/traefik/dynamic-ext).

### `typeOverrides`

Replaces the inferred shape of a type that **is** part of the generated output. The key is the Go package path plus the
Go type name; the value is a [type expression](#type-expressions) used as the whole declaration body.

Excerpt from `packages/kubernetypes`:

```json
{
  "typeOverrides": {
    "k8s.io/apimachinery/pkg/api/resource.Quantity": {
      "kind": "union",
      "elements": [
        {
          "kind": "string"
        },
        {
          "kind": "number"
        }
      ]
    },
    "k8s.io/apimachinery/pkg/apis/meta/v1.Time": {
      "kind": "string"
    }
  }
}
```

This is how Go types with custom marshaling (quantities, timestamps, `IntOrString`) are surfaced as the JSON values
Kubernetes actually accepts.

### `typeReplacements`

Substitutes references to types that are **not** part of the generated output. When the analyzer encounters a
cross-package reference to a type whose Go package has no generated declarations (standard library, external
dependencies), the configured type expression is inlined — otherwise the import could not be resolved and generation
fails.

Excerpt from `packages/@kubernetypes/traefik`:

```json
{
  "typeReplacements": {
    "net/http.Header": {
      "kind": "object-literal",
      "indexSignature": {
        "key": {
          "kind": "string"
        },
        "val": {
          "kind": "array",
          "element": {
            "kind": "string"
          }
        }
      }
    },
    "google.golang.org/grpc/codes.Code": {
      "kind": "number"
    },
    "github.com/traefik/paerser/types.Duration": {
      "kind": "number"
    }
  }
}
```

In short:

- `typeOverrides` — reshape a type you generate (declaration body is swapped out).
- `typeReplacements` — stand in for a type you do not generate (reference is inlined).

### Type expressions

Values of `typeOverrides` / `typeReplacements` are discriminated by `kind`:

| `kind`           | Fields                          | Rendered as                       |
| ---------------- | ------------------------------- | --------------------------------- |
| `string`         | —                               | `string`                          |
| `number`         | —                               | `number`                          |
| `boolean`        | —                               | `boolean`                         |
| `string-literal` | `raw`                           | `'Cluster'` (see note below)      |
| `object-literal` | `props?`, `indexSignature?`     | `{ … }`                           |
| `array`          | `element`                       | `T[]`                             |
| `reference`      | `name`, `namespace?`, `params?` | named type reference              |
| `intersection`   | `elements`                      | `A & B`                           |
| `union`          | `elements`                      | `A \| B`                          |
| `non-null`       | —                               | `{}`                              |
| `interface`      | `methods?`                      | method signatures                 |
| `function`       | —                               | `(...args: unknown[]) => unknown` |
| `unknown`        | —                               | `unknown`                         |

Notes:

- `object-literal` — `props` entries are `{ "name", "description?", "optional", "type" }`; `optional` is a required
  boolean and `description` becomes a JSDoc comment. `indexSignature` is `{ "key": <type>, "val": <type> }`. An object
  literal with no members renders as `{ [key: string]: unknown }`.
- `string-literal` — `raw` holds the JSON-encoded string value, so the literal `'Cluster'` is written as
  `"raw": "\"Cluster\""`.
- `reference` — within configs, use `name` alone to refer to a type from the same Go package (it lands in the same
  output file). Cross-package imports are resolved automatically during generation and must not be hand-authored.
- `interface` — `methods` entries are `{ "name", "embedded" }`; embedded entries render as catch-all index signatures.

## License

[MIT](./LICENSE)
