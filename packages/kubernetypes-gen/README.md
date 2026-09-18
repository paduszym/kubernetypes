# `kubernetypes-gen`

![NPM Version](https://img.shields.io/npm/v/kubernetypes-gen)
![NPM License](https://img.shields.io/npm/l/kubernetypes-gen)

## Usage

The generator behind `kubernetypes` and `@kubernetypes/*`: it produces TypeScript declaration files from
the Go source code of Kubernetes and Kubernetes-related projects. It is driven by the target package — exports with a
`kubernetypes` condition declare what to generate, and a `kubernetypes-gen.json` file provides the Go module
configuration.

### Requirements

- Node `>= 24.11`
- Go toolchain available in `PATH` (or via `GOBIN` / `GOROOT`)
- TypeScript `>= 5.9.3` (peer dependency)

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

- `types` — where the generated declaration file is written (relative to the package directory).
- `kubernetypes` — a `gopkg:` prefix followed by the Go package import path to translate into that file. This condition
  is only used by the generator at build time.

Exports of dependency packages participate in import resolution too, so generated declarations can reference types from
packages like `kubernetypes/apimachinery/apis/meta/v1`.

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

### 3. Run the generator

```shell
npx kubernetypes-gen ./path/to/package
```

`.d.ts` files are written to the paths from the `types` conditions. One exported type alias is produced per Go type; Go
doc comments become JSDoc, `deprecated:` notes become `@deprecated` tags, and `+kubebuilder:validation:Enum` markers on
string fields become string literal unions.

For the full `kubernetypes-gen.json` reference (`loaderGoMod.replace`, `typeOverrides`, `typeReplacements`, type
expressions), see the [repository README](https://github.com/paduszym/kubernetypes#using-kubernetypes-gen).

## License

MIT
