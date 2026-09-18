#!/usr/bin/env node

/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { resolve } from 'node:path';

import { generate } from '../../internal/kubernetypes/generate';

async function main(args: string[]) {
  const [packageDir] = args;
  if (packageDir === undefined) {
    console.error(`Usage: kubernetypes-gen <packageDir>\n`);
    return;
  }
  try {
    await generate(resolve(packageDir));
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}

await main(process.argv.slice(2));
