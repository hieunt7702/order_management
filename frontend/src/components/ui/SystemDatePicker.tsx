import React from 'react';
import Datepicker from 'react-tailwindcss-datepicker';
import { Calendar, X } from 'lucide-react';
import { cn } from '../../lib/utils';

const DatepickerComponent = Datepicker as any;

export interface DateRangeValue {
  startDate: string | null;
  endDate: string | null;
}

export interface SystemDatePickerProps {
  value?: DateRangeValue;
  startDate?: string | null;
  endDate?: string | null;
  onChange: (startDate: string | null, endDate: string | null) => void;
  placeholder?: string;
  size?: 'sm' | 'md';
  asSingle?: boolean;
  showShortcuts?: boolean;
  disabled?: boolean;
  className?: string;
  popoverDirection?: 'up' | 'down';
  allowClear?: boolean;
}

export const SystemDatePicker: React.FC<SystemDatePickerProps> = ({
  value,
  startDate,
  endDate,
  onChange,
  placeholder = 'Chọn khoảng ngày...',
  size = 'sm',
  asSingle = false,
  showShortcuts = true,
  disabled = false,
  className = '',
  popoverDirection = 'down',
  allowClear = true,
}) => {
  const currentStart = value !== undefined ? value.startDate : startDate ?? null;
  const currentEnd = value !== undefined ? value.endDate : endDate ?? null;

  const dateValue = {
    startDate: currentStart,
    endDate: asSingle ? currentStart : currentEnd,
  };

  const hasValue = Boolean(currentStart || currentEnd);

  const handleDateChange = (newValue: any) => {
    if (!newValue || (!newValue.startDate && !newValue.endDate)) {
      onChange(null, null);
      return;
    }

    const start = newValue.startDate ? String(newValue.startDate) : null;
    const end = asSingle
      ? start
      : newValue.endDate
        ? String(newValue.endDate)
        : start;

    onChange(start, end);
  };

  const handleClear = (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange(null, null);
  };

  const heightClass = size === 'sm' ? 'h-8 text-xs' : 'h-9 text-sm';

  return (
    <div
      className={cn(
        'relative flex items-center w-full sm:w-auto min-w-0 datepicker-wrapper group',
        size === 'sm' ? 'sm:min-w-[210px]' : 'sm:min-w-[240px]',
        className,
      )}
    >
      <div className="w-full min-w-0 relative">
        <DatepickerComponent
          value={dateValue}
          onChange={handleDateChange}
          asSingle={asSingle}
          useRange={!asSingle}
          displayFormat="DD/MM/YYYY"
          separator=" - "
          placeholder={placeholder}
          disabled={disabled}
          showShortcuts={showShortcuts && !asSingle}
          popoverDirection={popoverDirection}
          primaryColor="indigo"
          configs={{
            shortcuts: {
              today: 'Hôm nay',
              yesterday: 'Hôm qua',
              past: (period: any) => `${period} ngày trước`,
              currentMonth: 'Tháng này',
              pastMonth: 'Tháng trước',
            },
          }}
          containerClassName="relative w-full min-w-0"
          popupClassName={(defaultClass: string) => `datepicker-popup ${defaultClass || ''} z-50`}
          inputClassName={cn(
            'w-full min-w-0 bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-700/80 rounded font-normal text-gray-800 dark:text-gray-200 placeholder-gray-400 focus:outline-none focus:ring-[2px] focus:ring-[#5865f2]/20 focus:border-[#5865f2] transition-all cursor-pointer pl-8 pr-7 text-ellipsis overflow-hidden whitespace-nowrap',
            heightClass,
          )}
          toggleClassName="hidden pointer-events-none opacity-0 invisible"
          toggleIcon={() => null}
        />

        {/* Custom Calendar Icon at Left */}
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
          <Calendar size={size === 'sm' ? 13 : 15} />
        </div>

        {/* Clear Button (X) at Right */}
        {allowClear && hasValue && !disabled && (
          <button
            type="button"
            onClick={handleClear}
            className="absolute right-2 top-1/2 -translate-y-1/2 p-0.5 text-gray-400 hover:text-red-500 rounded-full hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors z-20 cursor-pointer"
            title="Xóa chọn ngày"
          >
            <X size={12} />
          </button>
        )}
      </div>
    </div>
  );
};
