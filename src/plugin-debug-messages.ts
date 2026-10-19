import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  App,
  PluginManifest
} from 'obsidian';

import { escapeRegExp } from '@mnaoumov/typescript-lib/reg-exp';

const DISABLED_PREFIX = '-';

interface PluginDebugMessagesConstructorParams {
  readonly app: App;
  readonly debugController: DebugController;
}

// Turns one installed plugin's debug messages on or off: its own `<id>` namespace and its `<id>:*` submodules, which
// is what a plugin README's `window.DEBUG.enable('<id>')` asks the user to type.
export class PluginDebugMessages {
  private readonly app: App;
  private readonly debugController: DebugController;

  public constructor(params: PluginDebugMessagesConstructorParams) {
    this.app = params.app;
    this.debugController = params.debugController;
  }

  public getPluginManifests(): PluginManifest[] {
    return Object.values(this.app.plugins.manifests).sort((a, b) => a.name.localeCompare(b.name) || a.id.localeCompare(b.id));
  }

  public isEnabled(pluginId: string): boolean {
    return isNamespaceEnabled(this.debugController.get(), pluginId);
  }

  public setEnabled(pluginId: string, isEnabled: boolean): void {
    const pluginNamespaces = getPluginNamespaces(pluginId);
    const removedNamespaces = new Set(isEnabled ? pluginNamespaces.map((namespace) => toDisabledNamespace(namespace)) : pluginNamespaces);
    const namespaces = this.debugController.get().filter((namespace) => !removedNamespaces.has(namespace));

    // Dropping our own entries is not enough when a wildcard such as `*` (on) or `-*` (off) still decides it, so the
    // explicit pair is added only then, and a plain toggle leaves the list as short as the user wrote it.
    if (isNamespaceEnabled(namespaces, pluginId) !== isEnabled) {
      for (const namespace of pluginNamespaces) {
        const entry = isEnabled ? namespace : toDisabledNamespace(namespace);
        if (!namespaces.includes(entry)) {
          namespaces.push(entry);
        }
      }
    }

    this.debugController.set(namespaces);
  }
}

function getPluginNamespaces(pluginId: string): string[] {
  return [pluginId, `${pluginId}:*`];
}

function isMatchingNamespacePattern(pattern: string, name: string): boolean {
  const trimmedPattern = pattern.trim();
  if (!trimmedPattern) {
    return false;
  }

  const regExpSource = trimmedPattern.split('*').map((part) => escapeRegExp(part)).join('.*?');
  return new RegExp(`^${regExpSource}$`).test(name);
}

// The same rule the `debug` library applies: a matching `-` entry wins over any matching enabled one.
function isNamespaceEnabled(namespaces: readonly string[], name: string): boolean {
  let isEnabled = false;
  for (const namespace of namespaces) {
    if (namespace.startsWith(DISABLED_PREFIX)) {
      if (isMatchingNamespacePattern(namespace.slice(DISABLED_PREFIX.length), name)) {
        return false;
      }
    } else if (isMatchingNamespacePattern(namespace, name)) {
      isEnabled = true;
    }
  }

  return isEnabled;
}

function toDisabledNamespace(namespace: string): string {
  return `${DISABLED_PREFIX}${namespace}`;
}
