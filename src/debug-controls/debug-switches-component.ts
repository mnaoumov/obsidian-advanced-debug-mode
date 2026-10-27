import type { PluginNoticeComponent } from '@mnaoumov/obsidian-lib/components/plugin-notice-component';
import type { DebugSwitchChange } from '@mnaoumov/typescript-lib/debug-switches';

import { registerAsyncEvent } from '@mnaoumov/obsidian-lib/components/async-events-component';
import { ComponentEx } from '@mnaoumov/obsidian-lib/components/component-ex';
import { invokeAsyncSafely } from '@mnaoumov/typescript-lib/async';
import {
  getDebugSwitch,
  getDebugSwitches,
  onDebugSwitchChanged,
  setDebugSwitch
} from '@mnaoumov/typescript-lib/debug-switches';

import type { PluginSettingsComponent } from '../settings/plugin-settings-component.ts';

const OWN_SAVE_CONTEXT = 'DebugSwitchesComponent';

interface DebugSwitchesComponentConstructorParams {
  readonly pluginNoticeComponent: PluginNoticeComponent;
  readonly pluginSettingsComponent: PluginSettingsComponent;
}

/**
 * Persists the app-wide `@mnaoumov/typescript-lib` debug switches in the plugin settings.
 *
 * Only a value that differs from its switch's default is stored, so every stored entry is one the user should be
 * reminded of: the stored values are applied on load, and a notice names them. A change made anywhere — the settings
 * tab, the console, another plugin — is stored, because the listener sees every change in every loaded copy of the
 * library. A value stored for a switch that is not registered yet is applied anyway: the registry keeps it and the
 * switch takes it when it registers.
 */
export class DebugSwitchesComponent extends ComponentEx {
  private readonly pluginNoticeComponent: PluginNoticeComponent;
  private readonly pluginSettingsComponent: PluginSettingsComponent;

  public constructor(params: DebugSwitchesComponentConstructorParams) {
    super();
    this.pluginNoticeComponent = params.pluginNoticeComponent;
    this.pluginSettingsComponent = params.pluginSettingsComponent;
  }

  public override onload(): void {
    this.applyStoredValues();
    this.showNonDefaultNotice();

    const listenerDisposable = onDebugSwitchChanged((change) => {
      invokeAsyncSafely(() => this.storeChange(change));
    });
    this.register(() => {
      listenerDisposable.dispose();
      // Without the plugin nothing would report a switch left off its default, so it is put back. The listener is gone
      // first, so the stored value is kept and the next load applies it again.
      for (const id of Object.keys(this.pluginSettingsComponent.settings.debugSwitches)) {
        resetToDefault(id);
      }
    });

    registerAsyncEvent(
      this,
      // Added after the initial load, so this is a reload of the settings file.
      this.pluginSettingsComponent.on('loadSettings', () => {
        // A switch whose entry the reloaded file no longer has goes back to its default. Every change since load was
        // stored by the listener, so a switch off its default with no entry was dropped from the file.
        for (const debugSwitch of getDebugSwitches()) {
          if (!Object.hasOwn(this.pluginSettingsComponent.settings.debugSwitches, debugSwitch.id)) {
            debugSwitch.setEnabled(debugSwitch.isEnabledByDefault);
          }
        }
        this.applyStoredValues();
      })
    );

    registerAsyncEvent(
      this,
      this.pluginSettingsComponent.on('saveSettings', (newState, oldState, context) => {
        // This component's own saves only record values the switches already have.
        if (context === OWN_SAVE_CONTEXT) {
          return;
        }

        // A save from elsewhere, such as a script editing the settings, applies only what it changed.
        const oldValues = oldState.effectiveValues.debugSwitches;
        const newValues = newState.effectiveValues.debugSwitches;
        for (const [id, isEnabled] of Object.entries(newValues)) {
          if (typeof isEnabled === 'boolean' && oldValues[id] !== isEnabled) {
            setDebugSwitch(id, isEnabled);
          }
        }
        for (const id of Object.keys(oldValues)) {
          if (!Object.hasOwn(newValues, id)) {
            resetToDefault(id);
          }
        }
      })
    );
  }

  private applyStoredValues(): void {
    for (const [id, isEnabled] of Object.entries(this.pluginSettingsComponent.settings.debugSwitches)) {
      if (typeof isEnabled !== 'boolean') {
        continue;
      }
      setDebugSwitch(id, isEnabled);
    }
  }

  private showNonDefaultNotice(): void {
    const descriptions: string[] = [];
    for (const [id, isEnabled] of Object.entries(this.pluginSettingsComponent.settings.debugSwitches)) {
      const debugSwitch = getDebugSwitch(id);
      // An entry written by hand may hold the default value, which needs no reminder.
      if (isEnabled !== debugSwitch?.isEnabledByDefault) {
        descriptions.push(`${debugSwitch?.name ?? id} (${isEnabled ? 'on' : 'off'})`);
      }
    }
    if (descriptions.length === 0) {
      return;
    }

    this.pluginNoticeComponent.showNotice(`Debug switches not at their default: ${descriptions.join(', ')}.`);
  }

  private async storeChange(change: DebugSwitchChange): Promise<void> {
    const debugSwitch = getDebugSwitch(change.id);
    const isDefault = change.isEnabled === debugSwitch?.isEnabledByDefault;
    const storedValues = this.pluginSettingsComponent.settings.debugSwitches;
    if (isDefault ? !Object.hasOwn(storedValues, change.id) : storedValues[change.id] === change.isEnabled) {
      return;
    }

    await this.pluginSettingsComponent.editAndSave((settings) => {
      const newValues = { ...settings.debugSwitches };
      if (isDefault) {
        // eslint-disable-next-line @typescript-eslint/no-dynamic-delete -- The record is keyed by switch id.
        delete newValues[change.id];
      } else {
        newValues[change.id] = change.isEnabled;
      }
      settings.debugSwitches = newValues;
    }, OWN_SAVE_CONTEXT);
  }
}

function resetToDefault(id: string): void {
  const debugSwitch = getDebugSwitch(id);
  // The default of a switch that is not registered is unknown, so its value is left alone.
  debugSwitch?.setEnabled(debugSwitch.isEnabledByDefault);
}
