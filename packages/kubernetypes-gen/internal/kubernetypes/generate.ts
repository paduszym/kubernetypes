/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { mkdir, mkdtempDisposable, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { dirname, join, normalize, resolve } from 'node:path';

import { bundleRender } from './bundle';
import { configRead } from './config';
import { go } from './go';
import { packageJsonTree } from './package';
import { transform, type TransformInput } from './transform';

export async function generate(packageDir: string) {
  const { loaderGoMod, typeOverrides = {}, typeReplacements = {} } = await configRead(packageDir);
  const packageFile = resolve(packageDir, 'package.json');
  const packageJsons = Array.from(packageJsonTree(packageFile));
  const rootPackageJson = packageJsons[0]!;

  const entry: TransformInput['entry'] = Object.create(null);
  for (const [subpath, { types: dtsFile, kubernetypes: goPkg }] of Object.entries(rootPackageJson.exports ?? {})) {
    if (dtsFile === undefined) {
      continue;
    }
    if (goPkg === undefined) {
      throw `Export '${subpath}' in ${rootPackageJson.name} has 'types' but no 'kubernetypes' condition.`;
    }
    entry[dtsFile] = goPkg;
  }

  const importResolve: TransformInput['importResolve'] = Object.create(null);
  for (const { name, exports = {} } of packageJsons) {
    for (const [subpath, { kubernetypes: goPkg }] of Object.entries(exports)) {
      if (goPkg === undefined) {
        continue;
      }
      const specifier = subpath.replace(/^\./, name);
      if (importResolve[goPkg] !== undefined) {
        throw `Go package '${goPkg}' is exported multiple times as '${importResolve[goPkg]}' and '${specifier}'.`;
      }
      importResolve[goPkg] = specifier;
    }
  }

  await using tempDir = await mkdtempDisposable(join(tmpdir(), 'kubernetypes-gen-'));
  const loaderDir = tempDir.path;
  go('mod', ['init', 'kubernetypes-gen'], { cwd: loaderDir });
  for (const [name, version] of Object.entries(loaderGoMod.require)) {
    go('get', [`${name}@${version}`], { cwd: loaderDir });
  }
  for (const [from, to] of Object.entries(loaderGoMod.replace ?? {})) {
    go('mod', ['edit', `-replace=${from}=${resolve(packageDir, to)}`], { cwd: loaderDir });
  }
  const loaderMainGo = `package main
  import (
  ${Object.values(entry)
    .map((pkgPath) => '\t' + JSON.stringify(pkgPath))
    .join('\n')}
  )`;
  await writeFile(join(loaderDir, 'main.go'), loaderMainGo);
  go('mod', ['tidy'], { cwd: loaderDir });

  const { bundles = [] } = transform({
    entry,
    loaderDir,
    importResolve,
    typeOverrides,
    typeReplacements,
  });
  for (const bundle of bundles) {
    const text = bundleRender(bundle);
    const file = join(packageDir, normalize(bundle.file));
    const dir = dirname(file);

    await mkdir(dir, { recursive: true });
    await writeFile(file, text);
  }
}
