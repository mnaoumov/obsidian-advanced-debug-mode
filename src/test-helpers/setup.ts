import { castTo } from 'obsidian-dev-utils/object-utils';

function setup(): void {
  setupObsidianDevUtilsState();
}

function setupObsidianDevUtilsState(): void {
  // eslint-disable-next-line obsidianmd/no-global-this -- Actively use globalThis.
  const record = castTo<Record<string, unknown>>(globalThis);
  const app = castTo<Record<string, unknown> | undefined>(record['app']);
  if (app && !('obsidianDevUtilsState' in app)) {
    app['obsidianDevUtilsState'] = {};
  }
}

setup();
