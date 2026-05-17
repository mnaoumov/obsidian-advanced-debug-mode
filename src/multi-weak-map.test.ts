import { noop } from 'obsidian-dev-utils/function';
import {
  describe,
  expect,
  it
} from 'vitest';

import { MultiWeakMap } from './multi-weak-map.ts';

describe('MultiWeakMap', () => {
  it('should store and retrieve values with object keys', () => {
    const map = new MultiWeakMap<[object, object], string>();
    const key1 = {};
    const key2 = {};
    map.set([key1, key2], 'value');
    expect(map.get([key1, key2])).toBe('value');
  });

  it('should return undefined for missing keys', () => {
    const map = new MultiWeakMap<[object], string>();
    const key = {};
    expect(map.get([key])).toBeUndefined();
  });

  it('should return undefined when partial key path exists', () => {
    const map = new MultiWeakMap<[object, object], string>();
    const key1 = {};
    const key2 = {};
    const key3 = {};
    map.set([key1, key2], 'value');
    expect(map.get([key1, key3])).toBeUndefined();
  });

  it('should overwrite existing values', () => {
    const map = new MultiWeakMap<[object], string>();
    const key = {};
    map.set([key], 'first');
    map.set([key], 'second');
    expect(map.get([key])).toBe('second');
  });

  it('should handle mixed object and primitive keys', () => {
    const map = new MultiWeakMap<[object, string, object], number>();
    const obj1 = {};
    const obj2 = {};
    map.set([obj1, 'primitive', obj2], 42);
    expect(map.get([obj1, 'primitive', obj2])).toBe(42);
  });

  it('should handle primitive-only keys via Map path', () => {
    const map = new MultiWeakMap<[string, number], string>();
    map.set(['hello', 123], 'world');
    expect(map.get(['hello', 123])).toBe('world');
  });

  it('should return undefined for primitive key not found', () => {
    const map = new MultiWeakMap<[string], string>();
    expect(map.get(['missing'])).toBeUndefined();
  });

  it('should handle function keys as weak map keys', () => {
    const map = new MultiWeakMap<[() => void], string>();
    map.set([noop], 'fn-value');
    expect(map.get([noop])).toBe('fn-value');
  });

  it('should handle null key as primitive (Map path)', () => {
    const map = new MultiWeakMap<[null], string>();
    map.set([null], 'null-value');
    expect(map.get([null])).toBe('null-value');
  });

  it('should keep separate entries for different key sequences', () => {
    const map = new MultiWeakMap<[object, string], number>();
    const key1 = {};
    const key2 = {};
    map.set([key1, 'a'], 1);
    map.set([key2, 'a'], 2);
    expect(map.get([key1, 'a'])).toBe(1);
    expect(map.get([key2, 'a'])).toBe(2);
  });

  it('should reuse existing child node on repeated set with same first key', () => {
    const map = new MultiWeakMap<[object, string], number>();
    const key = {};
    map.set([key, 'a'], 1);
    map.set([key, 'b'], 2);
    expect(map.get([key, 'a'])).toBe(1);
    expect(map.get([key, 'b'])).toBe(2);
  });

  it('should reuse existing child node on repeated set with same primitive first key', () => {
    const map = new MultiWeakMap<[string, string], number>();
    map.set(['x', 'a'], 1);
    map.set(['x', 'b'], 2);
    expect(map.get(['x', 'a'])).toBe(1);
    expect(map.get(['x', 'b'])).toBe(2);
  });
});
