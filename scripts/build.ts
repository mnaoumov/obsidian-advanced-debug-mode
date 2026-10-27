import { build } from '@mnaoumov/obsidian-dev-toolkit/bundlers/esbuild';
import { wrapCliTask } from '@mnaoumov/typescript-dev-toolkit/cli-utils';

import { ignoreListSources } from './ignore-list-sources.ts';

await wrapCliTask(() => build({ ignoreListSources }));
