import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  App,
  PluginManifest
} from 'obsidian';

import { castTo } from '@mnaoumov/typescript-lib/object-utils';
import { strictProxy } from '@mnaoumov/typescript-test-toolkit/strict-proxy';
import {
  describe,
  expect,
  it,
  vi
} from 'vitest';

import { PluginDebugMessages } from './plugin-debug-messages.ts';

interface CreatePluginDebugMessagesResult {
  readonly debugController: DebugController;
  readonly pluginDebugMessages: PluginDebugMessages;
}

function createManifest(id: string, name: string): PluginManifest {
  return { author: 'test', description: '', id, minAppVersion: '0.0.0', name, version: '1.0.0' };
}

function createPluginDebugMessages(initialNamespaces: string[] = [], manifests: Record<string, PluginManifest> = {}): CreatePluginDebugMessagesResult {
  let namespaces = initialNamespaces;
  const debugController = strictProxy<DebugController>({
    get: vi.fn(() => [...namespaces]),
    set: vi.fn((value: string | string[]) => {
      namespaces = Array.isArray(value) ? [...value] : value.split(',');
    })
  });
  const app = strictProxy<App>({ plugins: castTo<App['plugins']>({ manifests }) });
  return {
    debugController,
    pluginDebugMessages: new PluginDebugMessages({ app, debugController })
  };
}

function isEnabled(namespaces: string[], pluginId: string): boolean {
  return createPluginDebugMessages(namespaces).pluginDebugMessages.isEnabled(pluginId);
}

describe('PluginDebugMessages', () => {
  it('should read a plugin as on when its namespace matches exactly or by wildcard', () => {
    expect(isEnabled(['foo'], 'foo')).toBe(true);
    expect(isEnabled(['foo:*'], 'foo')).toBe(false);
    expect(isEnabled(['*'], 'foo')).toBe(true);
    expect(isEnabled(['f*o'], 'foo')).toBe(true);
    expect(isEnabled(['fo.'], 'foo')).toBe(false);
    expect(isEnabled([], 'foo')).toBe(false);
    expect(isEnabled(['', ' '], 'foo')).toBe(false);
  });

  it('should let a disabled entry win over an enabled one, in either order', () => {
    expect(isEnabled(['*', '-foo'], 'foo')).toBe(false);
    expect(isEnabled(['-foo', 'foo'], 'foo')).toBe(false);
    expect(isEnabled(['*', '-foo'], 'bar')).toBe(true);
  });

  it('should list the installed plugins sorted by name, then by id', () => {
    const { pluginDebugMessages } = createPluginDebugMessages([], {
      'a-1': createManifest('a-1', 'Same'),
      'a-2': createManifest('a-2', 'Same'),
      'b': createManifest('b', 'Alpha')
    });

    expect(pluginDebugMessages.getPluginManifests().map((manifest) => manifest.id)).toEqual(['b', 'a-1', 'a-2']);
  });

  it('should turn a plugin on by adding its namespace and its submodules', () => {
    const { debugController, pluginDebugMessages } = createPluginDebugMessages(['other']);
    expect(pluginDebugMessages.isEnabled('foo')).toBe(false);

    pluginDebugMessages.setEnabled('foo', true);

    expect(debugController.get()).toEqual(['other', 'foo', 'foo:*']);
    expect(pluginDebugMessages.isEnabled('foo')).toBe(true);
  });

  it('should turn a plugin off by removing its own entries only', () => {
    const { debugController, pluginDebugMessages } = createPluginDebugMessages(['foo', 'other', 'foo:*', 'foo:sub']);

    pluginDebugMessages.setEnabled('foo', false);

    expect(debugController.get()).toEqual(['other', 'foo:sub']);
    expect(pluginDebugMessages.isEnabled('foo')).toBe(false);
  });

  it('should disable a plugin explicitly when a wildcard would keep it on', () => {
    const { debugController, pluginDebugMessages } = createPluginDebugMessages(['*']);

    pluginDebugMessages.setEnabled('foo', false);

    expect(debugController.get()).toEqual(['*', '-foo', '-foo:*']);
    expect(pluginDebugMessages.isEnabled('foo')).toBe(false);
  });

  it('should drop the explicit disable when turning a plugin back on', () => {
    const { debugController, pluginDebugMessages } = createPluginDebugMessages(['*', '-foo', '-foo:*']);

    pluginDebugMessages.setEnabled('foo', true);

    expect(debugController.get()).toEqual(['*']);
    expect(pluginDebugMessages.isEnabled('foo')).toBe(true);
  });

  it('should not add an entry that is already there', () => {
    const { debugController, pluginDebugMessages } = createPluginDebugMessages(['foo:*', '-*']);

    pluginDebugMessages.setEnabled('foo', true);

    // `-*` still disables it; the toggle cannot outrank a blanket disable, and must not duplicate `foo:*`.
    expect(debugController.get()).toEqual(['foo:*', '-*', 'foo']);
  });
});
