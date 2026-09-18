import { pathToFileURL } from 'node:url';

import * as tsNode from 'ts-node-maintained';
import { createMatchPath, loadConfig } from 'tsconfig-paths';

const { absoluteBaseUrl, paths } = loadConfig();
const matchPath = createMatchPath(absoluteBaseUrl, paths);

const tsNodeService = tsNode.register({
  esm: true,
  experimentalSpecifierResolution: 'node',
  transpileOnly: false,
  pretty: true,
});

const { getFormat, load: loadTs, resolve: resolveTs, transformSource } = tsNode.createEsmHooks(tsNodeService);

function resolve(specifier, context, defaultResolver) {
  const mappedSpecifier = matchPath(specifier);
  if (mappedSpecifier) {
    specifier = pathToFileURL(mappedSpecifier).toString();
  }
  return resolveTs(specifier, context, defaultResolver);
}

function load(...args) {
  return loadTs(...args).catch((err) => {
    throw new Error(err);
  });
}

export { getFormat, load, resolve, transformSource };
