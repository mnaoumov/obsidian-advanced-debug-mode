export function isEventListenerObject(value: unknown): value is EventListenerObject {
  return !!(value as Partial<EventListenerObject> | undefined)?.handleEvent;
}
