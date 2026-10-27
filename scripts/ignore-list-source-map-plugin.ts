import type {
  BuildOptions,
  Plugin
} from 'esbuild';

import {
  decode,
  encode
} from '@jridgewell/sourcemap-codec';
import { existsSync } from 'node:fs';
import {
  readdir,
  readFile,
  rm,
  writeFile
} from 'node:fs/promises';
import {
  dirname,
  join
} from 'node:path';

const ERUDA_WEBPACK_SOURCE_PREFIX = 'webpack://eruda/';

const ERUDA_WEBPACK_SOURCE_NAME = 'webpack://eruda';

/**
 * The bundled modules that sit between a caller and a native API.
 *
 * DevTools links a console message to the top frame of its stack, and with this plugin loaded that frame is often one of
 * these wrappers rather than the code that logged: eruda's console replaces every `console.*` method, and the long stack
 * traces patch `addEventListener`, the timers and the `Promise` methods. A source map that ignore-lists them makes
 * DevTools skip them and link the message to its real caller.
 */
export const IGNORED_SOURCE_PATTERNS: readonly RegExp[] = [
  // Eruda's sources keep its webpack URLs, because esbuild chains eruda's own source map.
  /^webpack:\/\/eruda\//,
  /\/node_modules\/eruda\//,
  /\/node_modules\/monkey-around\//,
  // The library's sources are its `.ts` files, because esbuild chains its inline source maps.
  /\/node_modules\/@mnaoumov\/obsidian-lib\/(?:.*\/)?monkey-around-component\.(?:[cm]?js|ts)$/,
  /\/src\/operations\/file-system-adapter-[^/]+-patch-component\.ts$/,
  /\/src\/long-stack-traces\/(?:add-long-stack-traces|event-target-remove-event-listener)-patch-component\.ts$/,
  /\/src\/long-stack-traces\/desktop-(?:async-)?long-stack-traces-component\.ts$/
];

/**
 * Obsidian strips a plugin's inline source map unless debug mode is on or the file ends with this marker.
 */
const NO_SOURCE_MAP_MARKER = '\n/* nosourcemap */';

const INLINE_SOURCE_MAP_PREFIX = '//# sourceMappingURL=data:application/json;base64,';

const INLINE_SOURCE_MAP_REGEXP = /\n\/\/# sourceMappingURL=data:application\/json;base64,(?<SourceMapBase64>[^\n]+)/;

const EXTERNAL_SOURCE_MAP_REGEXP = /\n\/\/# sourceMappingURL=[^\n]+\.map\s*$/;

const SOURCE_MAP_VERSION = 3;

/**
 * A version 3 source map, as far as this plugin reads and writes it.
 */
export interface SourceMap {
  ignoreList?: number[];
  mappings: string;
  names?: string[];
  sources: string[];
  sourcesContent?: (null | string)[];
  version: number;
}

type MappingSegment = [number, number, number, number] | [number];

/**
 * Returns a copy of a full source map with every source that `isSourceIgnored` accepts listed in `ignoreList`.
 *
 * @param sourceMap - The full source map.
 * @param isSourceIgnored - Tells whether a source is ignore-listed.
 * @returns The source map with its `ignoreList` set.
 */
export function addIgnoreList(sourceMap: SourceMap, isSourceIgnored: (source: string) => boolean): SourceMap {
  const ignoreList = sourceMap.sources.flatMap((source, index) => isSourceIgnored(source) ? [index] : []);
  return { ...sourceMap, ignoreList };
}

/**
 * Builds a minimal source map that maps only the generated code coming from an ignore-listed source.
 *
 * Everything else stays unmapped, so DevTools keeps linking it to the generated script as it does with no source map at
 * all, and only the ignore-listed regions change: DevTools skips them when it picks a message's location. The map has
 * no `sourcesContent` and no names, and one segment per region boundary, so it adds little to a minified bundle.
 *
 * Measured in Chrome's own DevTools: a script whose map lists ONLY ignore-listed sources still links its unmapped frames
 * to itself, so the plugin's own messages keep pointing at the plugin.
 *
 * @param sourceMap - The full source map of the bundle.
 * @param getListedSourceName - Returns the name an ignore-listed source is listed under, or `null` for a source that is
 * not ignore-listed. Sources listed under a name other than their own are merged into one, and map to its start.
 * @returns The minimal source map, or `null` when no generated code comes from an ignore-listed source.
 */
export function createIgnoreListOnlySourceMap(sourceMap: SourceMap, getListedSourceName: (source: string) => null | string): null | SourceMap {
  const newSourceIndices = new Map<string, number>();
  const newSources: string[] = [];
  const UNMAPPED = -1;
  let previousTarget = UNMAPPED;

  const newLines = decode(sourceMap.mappings).map((segments) => {
    const newSegments: MappingSegment[] = [];
    for (const segment of segments) {
      const [generatedColumn, sourceIndex, sourceLine = 0, sourceColumn = 0] = segment;
      const source = sourceIndex === undefined ? undefined : sourceMap.sources[sourceIndex];
      const newSource = source === undefined ? null : getListedSourceName(source);
      let target = UNMAPPED;
      if (newSource !== null) {
        target = newSourceIndices.get(newSource) ?? newSources.length;
        if (target === newSources.length) {
          newSourceIndices.set(newSource, target);
          newSources.push(newSource);
        }
      }

      // A mapped region restarts on every line, as the spec has it; an unmapped one only needs its first segment.
      const isFirstOnLine = newSegments.length === 0;
      if (target === previousTarget && (!isFirstOnLine || target === UNMAPPED)) {
        continue;
      }

      if (target === UNMAPPED) {
        newSegments.push([generatedColumn]);
      } else if (newSource === source) {
        newSegments.push([generatedColumn, target, sourceLine, sourceColumn]);
      } else {
        newSegments.push([generatedColumn, target, 0, 0]);
      }
      previousTarget = target;
    }
    return newSegments;
  });

  if (newSources.length === 0) {
    return null;
  }

  return {
    ignoreList: newSources.map((_source, index) => index),
    mappings: encode(newLines),
    names: [],
    sources: newSources,
    version: SOURCE_MAP_VERSION
  };
}

/**
 * Returns the name an ignore-listed source goes under in the minimal production map, or `null` for any other source.
 *
 * Eruda's webpack build brings some 350 sources of its own. Listing each one made the inline map about 35 KB, and merged
 * into one `webpack://eruda` the whole map adds under 4 KB to the bundle. Nobody reads a line inside an ignored frame.
 *
 * @param source - A `sources` entry of the bundle's source map.
 * @returns The name to list the source under, or `null` when the source is not ignore-listed.
 */
export function getIgnoredSourceName(source: string): null | string {
  if (!isIgnoredSource(source)) {
    return null;
  }

  return source.startsWith(ERUDA_WEBPACK_SOURCE_PREFIX) ? ERUDA_WEBPACK_SOURCE_NAME : source;
}

/**
 * An esbuild plugin that gives the bundle an ignore-list source map (see {@link IGNORED_SOURCE_PATTERNS}).
 *
 * - A development build already carries a full inline source map; this adds its `ignoreList`.
 * - A production build carries none, so this makes esbuild write an external one, replaces it with the minimal map from
 *   {@link createIgnoreListOnlySourceMap} inlined into the bundle, and deletes the external files. The bundle then ends
 *   with Obsidian's `nosourcemap` marker, without which Obsidian strips the map whenever debug mode is off.
 *
 * It must come after the toolkit's own source-map fix, which rewrites the development map's sources, and before the
 * copy into the vault, which the toolkit already orders by placing custom plugins between the two.
 *
 * @returns The esbuild plugin.
 */
export function ignoreListSourceMapPlugin(): Plugin {
  return {
    name: 'ignore-list-source-map',
    setup(build): void {
      const options: BuildOptions = build.initialOptions;
      const shouldWriteExternalSourceMaps = !options.sourcemap;
      if (shouldWriteExternalSourceMaps) {
        options.sourcemap = 'external';
        options.sourcesContent = false;
      }

      const distPath = options.outfile;
      if (!distPath) {
        throw new Error('The ignore-list source map plugin needs the esbuild outfile option.');
      }

      build.onEnd(async (result) => {
        if (result.errors.length > 0 || !existsSync(distPath)) {
          return;
        }

        const content = await readFile(distPath, 'utf-8');
        const newContent = await rewriteBundle(content, distPath);
        if (newContent !== content) {
          await writeFile(distPath, newContent);
        }

        if (!shouldWriteExternalSourceMaps) {
          return;
        }

        // The external maps are read; esbuild writes one for the stylesheet too, which nothing needs.
        const distFolder = dirname(distPath);
        for (const fileName of await readdir(distFolder)) {
          if (fileName.endsWith('.map')) {
            await rm(join(distFolder, fileName));
          }
        }
      });
    }
  };
}

/**
 * Tells whether a source is one of {@link IGNORED_SOURCE_PATTERNS}.
 *
 * @param source - A `sources` entry of the bundle's source map.
 * @returns Whether the source is ignore-listed.
 */
export function isIgnoredSource(source: string): boolean {
  const posixSource = source.replaceAll('\\', '/');
  return IGNORED_SOURCE_PATTERNS.some((pattern) => pattern.test(posixSource));
}

function parseSourceMap(json: string): SourceMap {
  return JSON.parse(json) as SourceMap;
}

async function rewriteBundle(content: string, distPath: string): Promise<string> {
  const inlineMatch = INLINE_SOURCE_MAP_REGEXP.exec(content);
  if (inlineMatch) {
    const sourceMap = parseSourceMap(Buffer.from(inlineMatch.groups?.['SourceMapBase64'] ?? '', 'base64').toString('utf-8'));
    const newSourceMap = addIgnoreList(sourceMap, isIgnoredSource);
    return content.replace(inlineMatch[0], () => `\n${INLINE_SOURCE_MAP_PREFIX}${toBase64(newSourceMap)}`);
  }

  const mapPath = `${distPath}.map`;
  if (!existsSync(mapPath)) {
    return content;
  }

  const sourceMap = parseSourceMap(await readFile(mapPath, 'utf-8'));
  const bundle = content.replace(EXTERNAL_SOURCE_MAP_REGEXP, '');
  const newSourceMap = createIgnoreListOnlySourceMap(sourceMap, getIgnoredSourceName);
  return newSourceMap ? `${bundle.trimEnd()}\n${INLINE_SOURCE_MAP_PREFIX}${toBase64(newSourceMap)}${NO_SOURCE_MAP_MARKER}` : bundle;
}

function toBase64(sourceMap: SourceMap): string {
  return Buffer.from(JSON.stringify(sourceMap)).toString('base64');
}
