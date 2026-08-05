import type { GenericFunction } from 'obsidian-dev-utils/function';

export type GenericFunctionWithOriginalFunction = GenericFunction<unknown[]> & OriginalFunctionHolder;
export type GenericFunctionWithOriginalFunctionObject = Record<string, GenericFunction<unknown[]>>;
interface OriginalFunctionHolder {
  originalFunction?: GenericFunctionWithOriginalFunction;
}
