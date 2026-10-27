import type { GenericFunction } from '@mnaoumov/typescript-lib/function';

export type GenericFunctionWithOriginalFunction = GenericFunction<unknown[]> & OriginalFunctionHolder;
export type GenericFunctionWithOriginalFunctionObject = Record<string, GenericFunction<unknown[]>>;
interface OriginalFunctionHolder {
  readonly originalFunction?: GenericFunctionWithOriginalFunction;
}
