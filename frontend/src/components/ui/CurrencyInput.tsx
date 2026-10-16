import React, { useState, useEffect, useRef, useImperativeHandle, forwardRef } from 'react';
import { cn } from '../../lib/utils';

export interface CurrencyInputProps
  extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'value' | 'onChange'> {
  value: number | string | undefined | null;
  onChange: (value: number) => void;
  suffix?: string;
  className?: string;
  inputClassName?: string;
}

/**
 * Format raw number to Vietnamese currency string with dot thousands separator (e.g. 1.250.000)
 */
export const formatVnd = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const num = typeof val === 'number' ? val : parseInt(String(val).replace(/[^\d]/g, ''), 10);
  if (isNaN(num)) return '';
  return Math.round(num)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.');
};

/**
 * CurrencyInput - Premium numeric input formatted for VND currency
 * - Automatic thousand dot separators (100.000, 2.500.000)
 * - Automatic elimination of leading zeros (typing 32432 won't become 032432)
 * - Cursor position preservation while typing
 * - Auto-select on focus when value is 0 for effortless overwriting
 * - No browser spinner buttons
 */
export const CurrencyInput = forwardRef<HTMLInputElement, CurrencyInputProps>(function CurrencyInput(
  {
    value,
    onChange,
    suffix,
    className = '',
    inputClassName = '',
    placeholder = '0',
    disabled = false,
    onFocus,
    onBlur,
    ...props
  },
  ref,
) {
  const inputRef = useRef<HTMLInputElement>(null);
  useImperativeHandle(ref, () => inputRef.current as HTMLInputElement);

  const numValue = typeof value === 'number' ? value : value ? parseInt(String(value).replace(/[^\d]/g, ''), 10) || 0 : 0;

  const [displayValue, setDisplayValue] = useState<string>(() => {
    return numValue === 0 ? '0' : formatVnd(numValue);
  });

  const isFocusedRef = useRef(false);

  // Sync external value changes when not actively typing or if numeric value differs significantly
  useEffect(() => {
    const currentNum = parseInt(displayValue.replace(/[^\d]/g, ''), 10) || 0;
    if (numValue !== currentNum || !isFocusedRef.current) {
      setDisplayValue(numValue === 0 && isFocusedRef.current ? '' : formatVnd(numValue) || '0');
    }
  }, [numValue]);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target;
    const rawVal = input.value;
    const cursorPosition = input.selectionStart || 0;

    // Count how many digits existed before the cursor before formatting
    const digitsBeforeCursor = rawVal.slice(0, cursorPosition).replace(/[^\d]/g, '').length;

    // Extract digits only
    const digitsOnly = rawVal.replace(/[^\d]/g, '');

    if (!digitsOnly) {
      setDisplayValue('');
      onChange(0);
      return;
    }

    const parsed = parseInt(digitsOnly, 10);
    onChange(parsed);

    const formatted = formatVnd(parsed);
    setDisplayValue(formatted);

    // Maintain accurate cursor position after formatting
    requestAnimationFrame(() => {
      if (inputRef.current) {
        let targetPos = 0;
        let digitsCounted = 0;
        for (let i = 0; i < formatted.length; i++) {
          if (/\d/.test(formatted[i])) {
            digitsCounted++;
          }
          if (digitsCounted >= digitsBeforeCursor) {
            targetPos = i + 1;
            break;
          }
        }
        if (digitsBeforeCursor === 0) targetPos = 0;
        inputRef.current.setSelectionRange(targetPos, targetPos);
      }
    });
  };

  const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = true;
    // Auto-select text so typing immediately replaces initial '0'
    const curNum = parseInt(displayValue.replace(/[^\d]/g, ''), 10) || 0;
    if (curNum === 0) {
      e.target.select();
    }
    if (onFocus) onFocus(e);
  };

  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    isFocusedRef.current = false;
    if (!displayValue || displayValue.trim() === '') {
      setDisplayValue('0');
      onChange(0);
    } else {
      const curNum = parseInt(displayValue.replace(/[^\d]/g, ''), 10) || 0;
      setDisplayValue(formatVnd(curNum));
    }
    if (onBlur) onBlur(e);
  };

  return (
    <div className={cn('relative flex items-center w-full', className)}>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        value={displayValue}
        onChange={handleChange}
        onFocus={handleFocus}
        onBlur={handleBlur}
        placeholder={placeholder}
        disabled={disabled}
        className={cn(
          'w-full bg-white dark:bg-gray-800 border border-gray-300 dark:border-gray-700 rounded p-2 text-xs font-mono transition-colors focus:outline-none focus:ring-1 focus:ring-indigo-500 disabled:opacity-50 disabled:bg-gray-100 dark:disabled:bg-gray-900',
          suffix ? 'pr-7' : '',
          inputClassName,
        )}
        {...props}
      />
      {suffix && (
        <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs text-gray-400 dark:text-gray-500 font-medium pointer-events-none select-none">
          {suffix}
        </span>
      )}
    </div>
  );
});
