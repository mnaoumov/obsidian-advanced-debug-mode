export type GenericFunction = GenericMethod & OriginalFnCarrier;
export type GenericMethod = (this: unknown, ...args: unknown[]) => unknown;
export type GenericMethodObject = Record<string, GenericMethod>;
export type GenericObject = Record<string, GenericFunction>;
export interface OriginalFnCarrier {
  originalFn?: GenericFunction;
}
