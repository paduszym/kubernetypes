/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';

import { z } from 'zod';

export type PackageJson = z.infer<typeof PackageJson>;
export const PackageJson = z.object({
  name: z.string(),
  dependencies: z.lazy(() => PackageJsonDeps).optional(),
  peerDependencies: z.lazy(() => PackageJsonDeps).optional(),
  exports: z.lazy(() => PackageJsonExports).optional(),
});

export type PackageJsonDeps = z.infer<typeof PackageJsonDeps>;
export const PackageJsonDeps = z.record(z.string(), z.string());

export const PackageJsonExports = z.record(
  z.string().regex(/^(?:\.|\.\/.+)$/),
  z.object({
    types: z
      .string()
      .regex(/^\.\/.+$/)
      .optional(),
    kubernetypes: z
      .string()
      .regex(/^gopkg:.+$/)
      .transform((arg) => arg.replace(/^gopkg:/, ''))
      .optional(),
    default: z
      .string()
      .regex(/^\.\/.+$/)
      .optional(),
  }),
);

export function* packageJsonTree(file: string): Iterable<PackageJson> {
  const packageJson = packageJsonRead(file);
  const packageDeps: PackageJsonDeps = { ...packageJson.dependencies, ...packageJson.peerDependencies };

  yield packageJson;

  const require = createRequire(file);
  for (const name of Object.keys(packageDeps)) {
    yield* packageJsonTree(require.resolve(`${name}/package.json`));
  }
}

function packageJsonRead(file: string): PackageJson {
  const content = readFileSync(file, { encoding: 'utf-8' });
  const json = JSON.parse(content);
  return PackageJson.parse(json);
}
