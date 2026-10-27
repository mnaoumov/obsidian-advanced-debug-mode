import type { DebugController } from '@mnaoumov/typescript-lib/debug-controller';
import type {
  App,
  PluginManifest
} from 'obsidian';

import { escapeRegExp } from '@mnaoumov/typescript-lib/reg-exp';

const DISABLED_PREFIX = '-';

// The shared library logs under `<plugin id>:obsidian-lib:*` in every plugin that bundles it.
const LIBRARY_NAMESPACES = ['*:obsidian-lib:*'] as const;

interface PluginDebugMessagesConstructorParams {
  readonly app: App;
  readonly debugController: DebugController;
}

interface SetNamespacesEnabledParams {
  readonly currentNamespaces: readonly string[];
  readonly entries: readonly string[];
  readonly isEnabled: boolean;
  readonly stateNames: readonly string[];
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

  // A cheap fingerprint of everything a list of plugin rows shows, for a view that has no change event to listen to.
  public getStateSnapshot(): string {
    const enabledPluginIds = [...this.app.plugins.enabledPlugins].sort();
    const pluginIds = this.getPluginManifests().map((manifest) => `${manifest.id}\t${manifest.name}`);
    return JSON.stringify([this.debugController.get(), enabledPluginIds, pluginIds]);
  }

  public isEnabled(pluginId: string): boolean {
    return isNamespaceEnabled(this.debugController.get(), pluginId);
  }

  public isLibraryEnabled(): boolean {
    const namespaces = this.debugController.get();
    return LIBRARY_NAMESPACES.every((namespace) => isNamespaceEnabled(namespaces, namespace));
  }

  public isPluginEnabled(pluginId: string): boolean {
    return this.app.plugins.enabledPlugins.has(pluginId);
  }

  public setEnabled(pluginId: string, isEnabled: boolean): void {
    this.setManyEnabled([pluginId], isEnabled);
  }

  public setLibraryEnabled(isEnabled: boolean): void {
    this.debugController.set(setNamespacesEnabled({
      currentNamespaces: this.debugController.get(),
      entries: LIBRARY_NAMESPACES,
      isEnabled,
      stateNames: LIBRARY_NAMESPACES
    }));
  }

  // One write for the whole batch, so a bulk change reaches the `debug` library (and its storage) once.
  public setManyEnabled(pluginIds: readonly string[], isEnabled: boolean): void {
    let namespaces = this.debugController.get();
    for (const pluginId of pluginIds) {
      namespaces = setNamespacesEnabled({
        currentNamespaces: namespaces,
        entries: getPluginNamespaces(pluginId),
        isEnabled,
        stateNames: [pluginId]
      });
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

// `stateNames` are the names the state is read from: a plugin's own `<id>`, or the library patterns themselves, which a
// pattern list matches as literal names exactly when it would match every name the patterns stand for.
function setNamespacesEnabled(params: SetNamespacesEnabledParams): string[] {
  const { currentNamespaces, entries, isEnabled, stateNames } = params;
  const removedNamespaces = new Set(isEnabled ? entries.map((namespace) => toDisabledNamespace(namespace)) : entries);
  const namespaces = currentNamespaces.filter((namespace) => !removedNamespaces.has(namespace));

  // Dropping our own entries is not enough when a wildcard such as `*` (on) or `-*` (off) still decides it, so the
  // explicit entries are added only then, and a plain toggle leaves the list as short as the user wrote it.
  if (stateNames.some((name) => isNamespaceEnabled(namespaces, name) !== isEnabled)) {
    for (const namespace of entries) {
      const entry = isEnabled ? namespace : toDisabledNamespace(namespace);
      if (!namespaces.includes(entry)) {
        namespaces.push(entry);
      }
    }
  }

  return namespaces;
}

function toDisabledNamespace(namespace: string): string {
  return `${DISABLED_PREFIX}${namespace}`;
}
