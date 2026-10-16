import React from 'react';
import { Check, Minus } from 'lucide-react';

export interface CheckboxProps {
  checked: boolean;
  indeterminate?: boolean;
  onChange?: (e: { target: { checked: boolean } }) => void;
  className?: string;
  disabled?: boolean;
  size?: 'sm' | 'md' | 'lg';
  id?: string;
}

export const Checkbox: React.FC<CheckboxProps> = ({
  checked,
  indeterminate = false,
  onChange,
  className = '',
  disabled = false,
  size = 'md',
  id,
}) => {
  const sizeClasses = {
    sm: 'w-3.5 h-3.5 rounded',
    md: 'w-4 h-4 rounded-[5px]',
    lg: 'w-5 h-5 rounded-md',
  }[size];

  const iconSizes = {
    sm: 10,
    md: 12,
    lg: 14,
  }[size];

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (disabled) return;
    onChange && onChange({ target: { checked: !checked } });
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (disabled) return;
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      onChange && onChange({ target: { checked: !checked } });
    }
  };

  const isMarked = checked || indeterminate;

  return (
    <div
      id={id}
      role="checkbox"
      tabIndex={disabled ? -1 : 0}
      aria-checked={indeterminate ? 'mixed' : checked}
      aria-disabled={disabled}
      className={`relative inline-flex items-center justify-center shrink-0 cursor-pointer select-none transition-all duration-150 border ${sizeClasses} ${
        disabled
          ? 'opacity-40 cursor-not-allowed bg-gray-100 dark:bg-gray-800 border-gray-300 dark:border-gray-700'
          : isMarked
          ? 'bg-[#5865f2] border-[#5865f2] text-white shadow-2xs hover:bg-[#4752c4] hover:border-[#4752c4]'
          : 'bg-white dark:bg-[#131720] border-gray-300 dark:border-gray-600 hover:border-[#5865f2] dark:hover:border-[#5865f2] focus-visible:ring-2 focus-visible:ring-[#5865f2]/40'
      } ${className}`}
      onClick={handleClick}
      onKeyDown={handleKeyDown}
    >
      {indeterminate ? (
        <Minus size={iconSizes} strokeWidth={3.5} className="text-white" />
      ) : checked ? (
        <Check size={iconSizes} strokeWidth={3.5} className="text-white" />
      ) : null}
    </div>
  );
};

