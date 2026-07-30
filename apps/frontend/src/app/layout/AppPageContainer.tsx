import type { ReactNode } from 'react';
import clsx from 'clsx';

interface AppPageContainerProps {
  children: ReactNode;
  className?: string;
  size?: 'narrow' | 'default' | 'wide';
}

const SIZE_CLASSNAMES: Record<NonNullable<AppPageContainerProps['size']>, string> = {
  narrow: 'max-w-4xl',
  default: 'max-w-6xl',
  wide: 'max-w-7xl',
};

export function AppPageContainer({
  children,
  className,
  size = 'default',
}: AppPageContainerProps) {
  return <section className={clsx('mx-auto w-full', SIZE_CLASSNAMES[size], className)}>{children}</section>;
}
