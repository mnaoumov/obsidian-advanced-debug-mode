import { build } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { ignoreListSourceMapPlugin } from './ignore-list-source-map-plugin.ts';

await wrapCliTask(() => build({ customEsbuildPlugins: [ignoreListSourceMapPlugin()] }));
