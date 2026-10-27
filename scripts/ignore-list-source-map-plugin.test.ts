import type { SourceMapMappings } from '@jridgewell/sourcemap-codec';

import {
  decode,
  encode
} from '@jridgewell/sourcemap-codec';
import {
  describe,
  expect,
  it
} from 'vitest';

import type { SourceMap } from './ignore-list-source-map-plugin.ts';

import {
  addIgnoreList,
  createIgnoreListOnlySourceMap,
  getIgnoredSourceName,
  isIgnoredSource
} from './ignore-list-source-map-plugin.ts';

const OWN_SOURCE = '../../src/plugin.ts';
const PATCH_SOURCE = '../../src/patches/add-long-stack-traces-patch-component.ts';
const ERUDA_CONSOLE_SOURCE = 'webpack://eruda/src/Console/Console.js';
const ERUDA_LICIA_SOURCE = 'webpack://eruda/node_modules/licia/truncate.js';

function makeSourceMap(sources: string[], mappings: SourceMapMappings): SourceMap {
  return {
    mappings: encode(mappings),
    names: [],
    sources,
    version: 3
  };
}

describe('isIgnoredSource', () => {
  it.each([
    ERUDA_CONSOLE_SOURCE,
    '../../node_modules/eruda/eruda.js',
    '../../node_modules/monkey-around/dist/index.mjs',
    '../../node_modules/@mnaoumov/obsidian-lib/src/components/monkey-around-component.ts',
    '../../node_modules/@mnaoumov/obsidian-lib/dist/lib/esm/components/monkey-around-component.mjs',
    PATCH_SOURCE,
    String.raw`..\..\src\patches\event-target-remove-event-listener-patch-component.ts`,
    '../../src/long-stack-traces/desktop-long-stack-traces-component.ts',
    '../../src/long-stack-traces/desktop-async-long-stack-traces-component.ts'
  ])('should ignore-list %s', (source) => {
    expect(isIgnoredSource(source)).toBe(true);
  });

  it.each([
    OWN_SOURCE,
    '../../src/long-stack-traces/long-stack-traces-component.ts',
    '../../node_modules/@mnaoumov/obsidian-lib/src/components/component-ex.ts',
    '../../node_modules/debug/src/browser.js'
  ])('should not ignore-list %s', (source) => {
    expect(isIgnoredSource(source)).toBe(false);
  });
});

describe('getIgnoredSourceName', () => {
  it('should merge every eruda webpack source into one', () => {
    expect(getIgnoredSourceName(ERUDA_CONSOLE_SOURCE)).toBe('webpack://eruda');
    expect(getIgnoredSourceName(ERUDA_LICIA_SOURCE)).toBe('webpack://eruda');
  });

  it('should keep other ignore-listed sources under their own name', () => {
    expect(getIgnoredSourceName(PATCH_SOURCE)).toBe(PATCH_SOURCE);
  });

  it('should return null for a source that is not ignore-listed', () => {
    expect(getIgnoredSourceName(OWN_SOURCE)).toBeNull();
  });
});

describe('addIgnoreList', () => {
  it('should list the indices of the ignore-listed sources and keep everything else', () => {
    const sourceMap = { ...makeSourceMap([OWN_SOURCE, PATCH_SOURCE, ERUDA_CONSOLE_SOURCE], [[[0, 0, 0, 0]]]), sourcesContent: ['a', 'b', 'c'] };

    expect(addIgnoreList(sourceMap, isIgnoredSource)).toEqual({ ...sourceMap, ignoreList: [1, 2] });
  });
});

describe('createIgnoreListOnlySourceMap', () => {
  it('should return null when no generated code comes from an ignore-listed source', () => {
    expect(createIgnoreListOnlySourceMap(makeSourceMap([OWN_SOURCE], [[[0, 0, 0, 0]]]), getIgnoredSourceName)).toBeNull();
  });

  it('should map only the ignore-listed regions and end each one with an unmapped segment', () => {
    const sourceMap = makeSourceMap([OWN_SOURCE, PATCH_SOURCE], [
      [[0, 0, 0, 0], [10, 1, 5, 2], [20, 1, 6, 0], [30, 0, 9, 0], [40, 0, 10, 0]]
    ]);

    const result = createIgnoreListOnlySourceMap(sourceMap, getIgnoredSourceName);

    expect(result?.sources).toEqual([PATCH_SOURCE]);
    expect(result?.ignoreList).toEqual([0]);
    expect(result?.names).toEqual([]);
    expect(decode(result?.mappings ?? '')).toEqual([
      [[10, 0, 5, 2], [30]]
    ]);
  });

  it('should restart a mapped region on every line it spans', () => {
    const sourceMap = makeSourceMap([PATCH_SOURCE, OWN_SOURCE], [
      [[0, 0, 1, 0], [5, 0, 1, 5]],
      [[0, 0, 2, 0], [8, 1, 0, 0]],
      [[0, 1, 1, 0]]
    ]);

    const result = createIgnoreListOnlySourceMap(sourceMap, getIgnoredSourceName);

    expect(decode(result?.mappings ?? '')).toEqual([
      [[0, 0, 1, 0]],
      [[0, 0, 2, 0], [8]],
      []
    ]);
  });

  it('should merge sources listed under one name and map them to its start', () => {
    const sourceMap = makeSourceMap([ERUDA_CONSOLE_SOURCE, ERUDA_LICIA_SOURCE, OWN_SOURCE], [
      [[0, 0, 12, 3], [7, 1, 40, 1], [15, 2, 0, 0]]
    ]);

    const result = createIgnoreListOnlySourceMap(sourceMap, getIgnoredSourceName);

    expect(result?.sources).toEqual(['webpack://eruda']);
    expect(decode(result?.mappings ?? '')).toEqual([
      [[0, 0, 0, 0], [15]]
    ]);
  });

  it('should treat a segment with no source as unmapped', () => {
    const sourceMap = makeSourceMap([PATCH_SOURCE], [
      [[0, 0, 0, 0], [6], [9, 0, 0, 9]]
    ]);

    const result = createIgnoreListOnlySourceMap(sourceMap, getIgnoredSourceName);

    expect(decode(result?.mappings ?? '')).toEqual([
      [[0, 0, 0, 0], [6], [9, 0, 0, 9]]
    ]);
  });
});
