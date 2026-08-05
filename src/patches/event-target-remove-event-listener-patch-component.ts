import { MonkeyAroundComponent } from 'obsidian-dev-utils/obsidian/components/monkey-around-component';

import type { GenericFunctionWithOriginalFunction } from '../types.ts';

import { eventHandlersMap } from '../long-stack-traces/event-handlers-map.ts';
import { isEventListenerObject } from '../long-stack-traces/event-listener.ts';

export class EventTargetRemoveEventListenerPatchComponent extends MonkeyAroundComponent {
  public override onload(): void {
    this.registerMethodPatch({
      $object: EventTarget.prototype,
      methodName: 'removeEventListener',
      patchHandler: ({
        fallback,
        originalArguments: [type, callback, options],
        originalMethodBound,
        originalThis
      }) => {
        const handler = isEventListenerObject(callback) ? callback.handleEvent.bind(callback) : callback;
        if (!handler) {
          fallback();
          return;
        }

        const wrappedHandler = eventHandlersMap.get([originalThis, type, handler as GenericFunctionWithOriginalFunction]);

        if (wrappedHandler) {
          originalMethodBound(type, wrappedHandler, options);
        } else {
          originalMethodBound(type, callback, options);
        }
      }
    });
  }
}
