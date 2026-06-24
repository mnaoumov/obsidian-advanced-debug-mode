import type { GenericFunction } from 'obsidian-dev-utils/function';

export type GenericFunctionWithOriginalFn = GenericFunction<unknown[]> & OriginalFnHolder;
export type GenericFunctionWithOriginalFnObject = Record<string, GenericFunction<unknown[]>>;
interface OriginalFnHolder {
  originalFn?: GenericFunctionWithOriginalFn;
}
