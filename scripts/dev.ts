import { dev } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { ignoreListSourceMapPlugin } from './ignore-list-source-map-plugin.ts';

await wrapCliTask(() => dev({ customEsbuildPlugins: [ignoreListSourceMapPlugin()] }));
