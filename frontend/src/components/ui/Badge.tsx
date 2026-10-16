import React, { type HTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';

export type BadgeVariant =
  | 'default'
  | 'secondary'
  | 'outline'
  | 'success'
  | 'warning'
  | 'destructive'
  | 'info'
  | 'purple';

export interface BadgeProps extends HTMLAttributes<HTMLSpanElement> {
  className?: string;
  variant?: BadgeVariant;
  children?: ReactNode;
}

export function Badge({
  className = '',
  variant = 'default',
  children,
  ...props
}: BadgeProps) {
  const baseClasses =
    'inline-flex items-center gap-1 rounded px-2 py-0.5 text-xs font-semibold whitespace-nowrap transition-colors select-none';

  const variants: Record<BadgeVariant, string> = {
    default: 'bg-[#5865f2] text-white',
    secondary: 'bg-gray-100 dark:bg-[#2f3136] text-gray-700 dark:text-gray-300',
    outline:
      'border border-gray-200 dark:border-gray-700 text-gray-700 dark:text-gray-300',
    success:
      'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20',
    warning:
      'bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20',
    destructive:
      'bg-red-500/10 text-red-600 dark:text-red-400 border border-red-500/20',
    info: 'bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20',
    purple:
      'bg-purple-500/10 text-purple-600 dark:text-purple-400 border border-purple-500/20',
  };

  return (
    <span
      className={cn(baseClasses, variants[variant] || variants.default, className)}
      {...props}
    >
      {children}
    </span>
  );
}
