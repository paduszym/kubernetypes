/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { join } from 'node:path';

import z from 'zod';

import { Bundle } from './bundle';
import { go } from './go';
import type { Type } from './type';

export interface TransformInput {
  entry: { [dtsFile: string]: string };
  loaderDir: string;
  importResolve: { [pkgPath: string]: string };
  typeOverrides: { [typeId: string]: Type };
  typeReplacements: { [typeId: string]: Type };
}

export type TransformOutput = z.infer<typeof TransformOutput>;
export const TransformOutput = z.object({
  bundles: z.array(Bundle).optional(),
});

export function transform(input: TransformInput): TransformOutput {
  const stdout = go('run', ['./cmd/kubernetypes-transform/'], {
    cwd: join(import.meta.dirname, '..', '..'),
    stdin: JSON.stringify(input),
  });
  const json = JSON.parse(stdout);
  return TransformOutput.parse(json);
}
