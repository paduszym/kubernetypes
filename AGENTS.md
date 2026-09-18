# AGENTS.md

Guidance for AI coding agents working in this repository.

Project overview, package list, usage examples, and the `kubernetypes-gen.json` reference live in [README.md](./README.md) — read it first when touching packages or codegen configs.

## Repository layout

- `packages/kubernetypes-gen` — the code generator (hybrid TypeScript + Go; TypeScript orchestration in `internal/kubernetypes/*.ts`, Go analysis in `cmd/kubernetypes-transform/` and `internal/**/*.go`)
- `packages/kubernetypes`, `packages/@kubernetypes/traefik` — generated output packages
- `dist/` inside output packages is generated and gitignored. NEVER hand-edit it — change the generator or the package config, then regenerate.

## Prerequisites

- Node 24 (see `.nvmrc` and `engines` in the root `package.json`)
- Go toolchain available in `PATH` (or via `GOBIN` / `GOROOT`) — required for codegen
- Run `npm ci` at the repository root

## Commands

Run from the repository root:

| Command                                        | Purpose                                                     |
| ---------------------------------------------- | ----------------------------------------------------------- |
| `npm run eslint`                               | Lint the repository                                         |
| `npm run build:packages/kubernetypes-gen`      | Compile the generator with `tsc` (doubles as the typecheck) |
| `npm run build:packages/kubernetypes`          | Regenerate `packages/kubernetypes` into `dist/`             |
| `npm run build:packages/@kubernetypes/traefik` | Regenerate `packages/@kubernetypes/traefik` into `dist/`    |

There is no test framework. Verify changes with lint plus the relevant builds; for generator changes, regenerate both output packages.

Note: building the generator compiles `*.js` files next to the sources (gitignored), and `npm run eslint` picks them up. Run `git clean -xf packages/kubernetypes-gen` before linting if you see errors in `*.js` files.

## Code style

TypeScript is strict. Settings that affect how you write code:

- `verbatimModuleSyntax` — use `import type` / inline `type` modifiers for type-only imports
- `noUncheckedIndexedAccess` — index access yields `T | undefined`
- `noPropertyAccessFromIndexSignature` — access index signatures with brackets (e.g. `process.env['GOBIN']`)
- `module: Preserve` — Node-style ESM

Conventions:

- Every source file starts with the SPDX header:
  ```
  /*
   * SPDX-License-Identifier: MIT
   * Copyright (c) 2026 Mateusz Paduszyński
   */
  ```
- Imports are enforced by `eslint-plugin-import-x`: alphabetized within groups, groups ordered `builtin`, `external`, `internal`, `parent`, `sibling`, `index`, `object`, with blank lines between groups; no duplicate imports.
- Prettier: single quotes, print width 120, 2-space indent, LF line endings, trailing commas everywhere.
- Keep comments minimal; do not add JSDoc to internal functions.

## Git hooks

Husky pre-commit runs lint-staged (skipped when `CI` is set): `prettier -w -u` on all staged files and `eslint --fix` on `js/mjs/ts/mts` files.
