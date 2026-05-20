import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { GenericFunction } from '../types.ts';

import { eventHandlersMap } from '../long-stack-traces/event-handlers-map.ts';
import { isEventListenerObject } from '../long-stack-traces/event-listener.ts';

export class RemoveEventListenerPatchComponent extends MonkeyAroundComponent {
  public override onload(): void {
    this.registerMethodPatch({
      methodName: 'removeEventListener',
      obj: EventTarget.prototype,
      patchHandler: ({
        fallback,
        originalArgs: [type, callback, options],
        originalMethodBound,
        originalThis
      }) => {
        const handler = isEventListenerObject(callback) ? callback.handleEvent.bind(callback) : callback;
        if (!handler) {
          fallback();
          return;
        }

        const wrappedHandler = eventHandlersMap.get([originalThis, type, handler as GenericFunction]);

        if (wrappedHandler) {
          originalMethodBound(type, wrappedHandler, options);
        } else {
          originalMethodBound(type, callback, options);
        }
      }
    });
  }
}
