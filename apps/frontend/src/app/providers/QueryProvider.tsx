import type { ReactNode } from 'react';
import { QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { queryClient } from '@/lib/query/queryClient';

const IS_DEV = import.meta.env.DEV;

/**
 * Provider cho TanStack Query — bọc toàn bộ app.
 * DevTools chỉ hiện trong development (import.meta.env.DEV).
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      {children}
      {IS_DEV && <ReactQueryDevtools initialIsOpen={false} />}
    </QueryClientProvider>
  );
}
