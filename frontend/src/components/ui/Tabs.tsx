import React, {
  createContext,
  useContext,
  type ReactNode,
  type HTMLAttributes,
  type ButtonHTMLAttributes,
} from 'react';
import { cn } from '../../lib/utils';

interface TabsContextType {
  value?: string;
  onValueChange?: (val: string) => void;
}

const TabsContext = createContext<TabsContextType | null>(null);

export interface TabsProps extends HTMLAttributes<HTMLDivElement> {
  value?: string;
  onValueChange?: (val: string) => void;
  className?: string;
  children?: ReactNode;
}

export function Tabs({
  value,
  onValueChange,
  className = '',
  children,
  ...props
}: TabsProps) {
  return (
    <TabsContext.Provider value={{ value, onValueChange }}>
      <div className={cn('flex flex-col gap-3', className)} {...props}>
        {children}
      </div>
    </TabsContext.Provider>
  );
}

export function TabsList({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'inline-flex items-center gap-1 p-1 bg-gray-100/80 dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded overflow-x-auto',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export interface TabsTriggerProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  value: string;
  className?: string;
  children?: ReactNode;
}

export function TabsTrigger({
  value,
  className = '',
  children,
  ...props
}: TabsTriggerProps) {
  const context = useContext(TabsContext);
  const isActive = context?.value === value;

  return (
    <button
      type="button"
      onClick={() => context?.onValueChange?.(value)}
      className={cn(
        'px-3 py-1.5 rounded text-xs font-medium whitespace-nowrap transition-all cursor-pointer select-none border-0',
        isActive
          ? 'bg-[#5865f2] text-white shadow-xs font-semibold'
          : 'text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-white/50 dark:hover:bg-[#1a1b23]/50',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export interface TabsContentProps extends HTMLAttributes<HTMLDivElement> {
  value: string;
  className?: string;
  children?: ReactNode;
}

export function TabsContent({
  value,
  className = '',
  children,
  ...props
}: TabsContentProps) {
  const context = useContext(TabsContext);
  if (context?.value !== value) return null;

  return (
    <div className={cn('animate-fade-in outline-none', className)} {...props}>
      {children}
    </div>
  );
}
