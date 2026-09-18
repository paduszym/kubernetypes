/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { z } from 'zod';

import { Type } from './type';

export type Declaration = z.infer<typeof Declaration>;
export const Declaration = z.object({
  name: z.string(),
  description: z.string().optional(),
  exported: z.boolean(),
  typeParameters: z.array(z.lazy(() => TypeParameterDeclaration)).optional(),
  type: Type,
});

export const TypeParameterDeclaration = z.object({
  name: z.string(),
  constraint: Type.optional(),
  default: Type.optional(),
});
