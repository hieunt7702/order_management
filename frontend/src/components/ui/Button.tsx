import React, { type ButtonHTMLAttributes, type ReactNode } from 'react';
import { cn } from '../../lib/utils';
import { Loader2 } from 'lucide-react';

export type ButtonVariant =
  | 'default'
  | 'outline'
  | 'secondary'
  | 'ghost'
  | 'destructive'
  | 'link';

export type ButtonSize =
  | 'default'
  | 'xs'
  | 'sm'
  | 'lg'
  | 'icon'
  | 'icon-xs'
  | 'icon-sm'
  | 'icon-lg';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  className?: string;
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  disabled?: boolean;
  children?: ReactNode;
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  function Button(
    {
      className = '',
      variant = 'default',
      size = 'default',
      loading = false,
      disabled = false,
      type = 'button',
      children,
      ...props
    },
    ref,
  ) {
    const baseClasses =
      'group/button inline-flex shrink-0 items-center justify-center rounded border border-transparent text-sm font-medium whitespace-nowrap transition-all outline-none select-none focus-visible:ring-2 focus-visible:ring-[#5865f2]/40 active:translate-y-px disabled:pointer-events-none disabled:opacity-50 cursor-pointer';

    const variants: Record<ButtonVariant, string> = {
      default: 'bg-[#5865f2] hover:bg-[#4752c4] text-white shadow-none border-0',
      outline:
        'border border-gray-200 dark:border-gray-700 bg-white dark:bg-[#1a1b23] text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-[#262930]',
      secondary:
        'bg-gray-100 dark:bg-[#2f3136] text-gray-800 dark:text-gray-200 hover:bg-gray-200 dark:hover:bg-[#36393f]',
      ghost:
        'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800',
      destructive:
        'bg-red-500/10 text-red-600 dark:text-red-400 hover:bg-red-500/20 border border-red-200 dark:border-red-900/50',
      link: 'text-[#5865f2] underline-offset-4 hover:underline p-0 h-auto',
    };

    const sizes: Record<ButtonSize, string> = {
      default: 'h-8 gap-1.5 px-3 text-sm',
      xs: 'h-6 gap-1 px-2 text-xs',
      sm: 'h-7 gap-1 px-2.5 text-xs',
      lg: 'h-9 gap-1.5 px-4 text-sm',
      icon: 'w-8 h-8 p-0',
      'icon-xs': 'w-6 h-6 p-0',
      'icon-sm': 'w-7 h-7 p-0',
      'icon-lg': 'w-9 h-9 p-0',
    };

    return (
      <button
        ref={ref}
        type={type}
        disabled={disabled || loading}
        className={cn(
          baseClasses,
          variants[variant] || variants.default,
          sizes[size] || sizes.default,
          className,
        )}
        {...props}
      >
        {loading && <Loader2 className="w-3.5 h-3.5 animate-spin mr-1 shrink-0" />}
        {children}
      </button>
    );
  },
);
