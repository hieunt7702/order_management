import React, { type ReactNode, type InputHTMLAttributes, type ComponentType } from 'react';
import { RotateCcw, Search } from 'lucide-react';
import { cn } from '../../lib/utils';

export const SystemFilter: React.FC<{
  children?: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => {
  return (
    <div
      className={cn(
        'flex flex-wrap items-center gap-3 p-3 bg-white dark:bg-[#14151a] border border-gray-200 dark:border-gray-800 rounded',
        className,
      )}
    >
      {children}
    </div>
  );
};

export const SystemFilterItem: React.FC<{
  icon?: ComponentType<{ className?: string }>;
  label?: string;
  children?: ReactNode;
  className?: string;
}> = ({ icon: Icon, label, children, className = '' }) => {
  return (
    <div className={cn('flex items-center gap-2', className)}>
      {Icon && (
        <Icon className="w-3.5 h-3.5 text-gray-500 dark:text-gray-400 shrink-0" />
      )}
      {label && (
        <span className="text-xs font-semibold text-gray-500 dark:text-gray-400 shrink-0">
          {label}
        </span>
      )}
      {children}
    </div>
  );
};

export interface SystemFilterSearchProps
  extends Omit<InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
  value: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  placeholder?: string;
  className?: string;
}

export const SystemFilterSearch: React.FC<SystemFilterSearchProps> = ({
  value,
  onChange,
  placeholder = 'Tìm kiếm...',
  className = 'w-64',
  ...props
}) => {
  return (
    <div className={cn('relative', className)}>
      <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
      <input
        type="text"
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        className="pl-8 pr-3 py-1 w-full h-8 bg-gray-50 dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700 rounded text-xs sm:text-sm focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/20 text-gray-900 dark:text-gray-100 placeholder-gray-400 transition-all font-normal"
        {...props}
      />
    </div>
  );
};

export const SystemFilterReset: React.FC<{
  onClick?: () => void;
  label?: string;
}> = ({ onClick, label = 'Xóa bộ lọc' }) => {
  return (
    <div className="flex items-center ml-auto">
      <button
        type="button"
        onClick={onClick}
        className="flex items-center gap-1.5 text-xs sm:text-[13px] font-medium text-red-600 dark:text-red-400 bg-white dark:bg-[#1a1b23] border border-red-200 dark:border-red-900/50 hover:bg-red-50 dark:hover:bg-red-900/20 px-3 h-8 rounded transition-colors cursor-pointer select-none"
      >
        <RotateCcw className="w-3.5 h-3.5" /> {label}
      </button>
    </div>
  );
};
