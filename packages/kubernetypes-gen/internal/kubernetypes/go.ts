/*
 * SPDX-License-Identifier: MIT
 * Copyright (c) 2026 Mateusz Paduszyński
 */
import { spawnSync } from 'node:child_process';
import { join } from 'node:path';

export function go(cmd: string, args: string[], options: { cwd: string; stdin?: string }) {
  goBinPath ??= goBinPathDetect();
  const { status, stdout, stderr, error } = spawnSync(goBinPath, [cmd, ...args], {
    cwd: options.cwd,
    input: options.stdin,
    encoding: 'utf-8',
    maxBuffer: 64 * 1024 * 1024,
  });
  if (error !== undefined) {
    throw `Failed to execute:\n\n${[goBinPath, cmd, ...args].join(' ')}\n\nUnexpected error: ${error.message}`;
  }
  if (status !== 0) {
    throw `Failed to execute:\n\n${[goBinPath, cmd, ...args].join(' ')}\n\nStatus:\n-------\n${status}\n\nStderr:\n-------\n${stderr}`;
  }
  return stdout;
}

function goBinPathDetect() {
  const path = process.env['GOBIN'] ?? (process.env['GOROOT'] ? join(process.env['GOROOT'], 'bin', 'go') : 'go');
  const { error, status } = spawnSync(path, ['version']);
  if (error !== undefined || status !== 0) {
    throw `Can't find 'go' command in system - ensure its in PATH or set appropriate GOBIN / GOROOT variable.`;
  }
  return path;
}

let goBinPath: string;
