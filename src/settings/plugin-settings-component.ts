import type { DataHandler } from '@mnaoumov/obsidian-lib/data-handler';
import type { PluginEventSource } from '@mnaoumov/obsidian-lib/plugin/plugin-event-source';
import type { MaybeReturn } from '@mnaoumov/typescript-lib/type';
import type { GenericObject } from '@mnaoumov/typescript-lib/type-guards';

import { PluginSettingsComponentBase } from '@mnaoumov/obsidian-lib/components/plugin-settings-component';

import { isValidDelay } from '../plugin-load-delays/plugin-load-delays.ts';
import { PluginSettings } from './plugin-settings.ts';

const DELAY_VALIDATION_MESSAGE = 'The delay must be a whole number of milliseconds, 0 or greater';

interface PluginSettingsComponentConstructorParams {
  readonly dataHandler: DataHandler;
  readonly pluginEventSource: PluginEventSource;
}

export class PluginSettingsComponent extends PluginSettingsComponentBase<PluginSettings> {
  public constructor(params: PluginSettingsComponentConstructorParams) {
    super({
      ...params,
      pluginSettingsClass: PluginSettings
    });
  }

  // Versions whose patched `Error.stackTraceLimit` setter persisted every runtime write could save a negative limit. The
  // validator only makes the effective value the default, so the stored value is rewritten here, and `loadFromFile`
  // saves the repaired record once because it now differs from `data.json`.
  protected override async onLoadRecord(record: GenericObject): Promise<void> {
    await super.onLoadRecord(record);
    if ('stackTraceLimit' in record && !isValidStackTraceLimit(record['stackTraceLimit'])) {
      record['stackTraceLimit'] = new PluginSettings().stackTraceLimit;
    }
  }

  protected override registerValidators(): void {
    super.registerValidators();
    this.registerValidator('stackTraceLimit', (value): MaybeReturn<string> => {
      if (!isValidStackTraceLimit(value)) {
        return 'The stack trace limit must be a whole number, 0 or greater';
      }
    });
    for (
      const propertyName of [
        'defaultPluginLoadDelayInMilliseconds',
        'layoutLoadDelayInMilliseconds',
        'metadataCacheInitializeDelayInMilliseconds',
        'pluginLoadDelayJitterInMilliseconds'
      ] as const
    ) {
      this.registerValidator(propertyName, (value): MaybeReturn<string> => {
        if (!isValidDelay(value)) {
          return DELAY_VALIDATION_MESSAGE;
        }
      });
    }
    this.registerValidator('pluginLoadDelaysInMilliseconds', (value): MaybeReturn<string> => {
      if (!Object.values(value).every(isValidDelay)) {
        return DELAY_VALIDATION_MESSAGE;
      }
    });
  }
}

function isValidStackTraceLimit(value: unknown): boolean {
  return typeof value === 'number' && Number.isSafeInteger(value) && value >= 0;
}
