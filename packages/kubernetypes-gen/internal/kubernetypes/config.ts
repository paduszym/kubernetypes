/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { z } from 'zod';

import { Type } from './type';

export type Config = z.infer<typeof Config>;
export const Config = z.object({
  loaderGoMod: z.object({
    require: z.record(z.string(), z.string()),
    replace: z.record(z.string(), z.string()).optional(),
  }),
  typeOverrides: z.record(z.string(), Type).optional(),
  typeReplacements: z.record(z.string(), Type).optional(),
});

export async function configRead(contextDir: string): Promise<Config> {
  const file = join(contextDir, 'kubernetypes-gen.json');
  const content = await readFile(file, { encoding: 'utf-8' });
  const json = JSON.parse(content);
  return Config.parse(json);
}
