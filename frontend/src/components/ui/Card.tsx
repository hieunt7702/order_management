import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export interface UICardProps extends HTMLAttributes<HTMLDivElement> {
  className?: string;
  size?: 'default' | 'sm' | 'lg';
  children?: ReactNode;
}

export function Card({
  className,
  size = 'default',
  children,
  ...props
}: UICardProps) {
  return (
    <div
      data-slot="card"
      data-size={size}
      className={cn(
        'group/card flex flex-col overflow-hidden rounded bg-white dark:bg-[#181b22] border border-gray-200 dark:border-gray-800 text-sm text-gray-900 dark:text-gray-100 shadow-none',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardHeader({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  const isRow = className?.includes('flex-row');
  return (
    <div
      data-slot="card-header"
      className={cn(
        'p-4 sm:p-5 border-b border-gray-100 dark:border-gray-800',
        isRow ? 'flex flex-row items-center justify-between gap-3' : 'flex flex-col gap-1.5',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardTitle({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLHeadingElement>) {
  return (
    <h3
      data-slot="card-title"
      className={cn(
        'text-base font-medium leading-none tracking-tight text-gray-900 dark:text-white',
        className,
      )}
      {...props}
    >
      {children}
    </h3>
  );
}

export function CardDescription({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLParagraphElement>) {
  return (
    <p
      data-slot="card-description"
      className={cn('text-xs text-gray-500 dark:text-gray-400 mt-0.5', className)}
      {...props}
    >
      {children}
    </p>
  );
}

export function CardContent({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-content"
      className={cn('p-4 sm:p-5', className)}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardFooter({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-footer"
      className={cn(
        'flex items-center p-4 sm:p-5 pt-0 border-t border-gray-100 dark:border-gray-800',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function CardAction({
  className,
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      data-slot="card-action"
      className={cn('flex items-center gap-2', className)}
      {...props}
    >
      {children}
    </div>
  );
}


