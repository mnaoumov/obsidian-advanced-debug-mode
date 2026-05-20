export type GenericFunction = ((this: unknown, ...args: unknown[]) => unknown) & { originalFn?: GenericFunction };
export type GenericObject = Record<string, GenericFunction>;
