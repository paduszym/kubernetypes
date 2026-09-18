import { register } from 'node:module';

import * as tsNode from 'ts-node-maintained';

tsNode.register({
  esm: true,
  experimentalSpecifierResolution: 'node',
  transpileOnly: false,
  pretty: true,
  require: ['tsconfig-paths/register'],
});

register('./loader.mjs', import.meta.url);
