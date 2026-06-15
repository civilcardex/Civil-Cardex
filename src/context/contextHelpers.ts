import { useContext, type Context } from 'react';

export function createUseContext<T>(Ctx: Context<T | null>, name: string) {
  return function useThisContext(): T {
    const ctx = useContext(Ctx);
    if (!ctx) throw new Error(`${name} must be used within its provider`);
    return ctx;
  };
}
