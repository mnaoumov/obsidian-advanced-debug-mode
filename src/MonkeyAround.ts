import type { Plugin } from 'obsidian';
import type { ConditionalKeys } from 'type-fest';

import { around as originalAround } from 'monkey-around';

export type Factories<Obj extends object> = Partial<
  {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
    [Key in ConditionalKeys<Obj, Function>]: WrapperFactory<Extract<Obj[Key], Function>>;
  }
>;

type OriginalFactories<Obj extends Record<string, unknown>> = Parameters<typeof originalAround<Obj>>[1];

type Uninstaller = () => void;

// eslint-disable-next-line @typescript-eslint/no-unsafe-function-type
type WrapperFactory<T extends Function> = (next: T) => T;

export function around<Obj extends object>(obj: Obj, factories: Factories<Obj>): Uninstaller {
  return originalAround(obj as Record<string, unknown>, factories as OriginalFactories<Record<string, unknown>>);
}

export function registerPatch<Obj extends object>(plugin: Plugin, obj: Obj, factories: Factories<Obj>): void {
  plugin.register(around(obj, factories));
}
