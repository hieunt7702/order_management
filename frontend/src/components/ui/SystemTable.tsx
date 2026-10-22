import React, { type ReactNode, type ComponentType, type MouseEvent } from 'react';
import { ChevronLeft, ChevronRight, Inbox } from 'lucide-react';
import { Select } from './Select';
import { cn } from '../../lib/utils';

export interface SystemTableWrapperProps {
  children?: ReactNode;
  pagination?: ReactNode;
  tableClassName?: string;
  className?: string;
}

export const SystemTableWrapper: React.FC<SystemTableWrapperProps> = ({
  children,
  pagination,
  tableClassName = 'min-w-[1000px]',
  className = '',
}) => {
  return (
    <div
      className={cn(
        'flex-1 flex flex-col min-h-[380px] md:min-h-0 rounded border border-gray-200/60 dark:border-white/[0.08] bg-white dark:bg-[#14151a] shadow-none overflow-hidden shrink-0 md:shrink',
        className,
      )}
    >
      <div className="relative flex-1 flex flex-col min-h-[300px] md:min-h-0">
        <div className="flex-1 overflow-auto custom-scrollbar">
          <table
            className={cn(
              'w-full text-left border-collapse table-fixed',
              tableClassName,
            )}
          >
            {children}
          </table>
        </div>
      </div>
      {pagination && pagination}
    </div>
  );
};

export interface SystemTableEmptyProps {
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title?: string;
  description?: string;
  message?: string;
  colSpan?: number;
}

export const SystemTableEmpty: React.FC<SystemTableEmptyProps> = ({
  icon: Icon = Inbox,
  title = 'Không có dữ liệu',
  description,
  message,
  colSpan = 100,
}) => {
  const displayDesc = description || message || 'Không tìm thấy bản ghi nào phù hợp với điều kiện tìm kiếm.';

  return (
    <tr>
      <td
        colSpan={colSpan}
        className="px-5 py-20 text-center border-none bg-transparent"
      >
        <div className="flex flex-col items-center justify-center my-auto">
          <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
            <Icon size={24} strokeWidth={1.5} />
          </div>
          <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
            {title}
          </h3>
          <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
            {displayDesc}
          </p>
        </div>
      </td>
    </tr>
  );
};

export interface SystemMobileEmptyProps {
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  title?: string;
  description?: string;
  message?: string;
  className?: string;
}

export const SystemMobileEmpty: React.FC<SystemMobileEmptyProps> = ({
  icon: Icon = Inbox,
  title = 'Không có dữ liệu',
  description,
  message,
  className = '',
}) => {
  const displayDesc = description || message || 'Không tìm thấy bản ghi nào phù hợp với điều kiện tìm kiếm.';

  return (
    <div
      className={cn(
        'p-6 sm:p-8 text-center flex flex-col items-center justify-center my-auto bg-white dark:bg-[#14151a] rounded border border-gray-100 dark:border-gray-800/80 shadow-xs',
        className,
      )}
    >
      <div className="w-12 h-12 rounded-full bg-gray-100 dark:bg-gray-800 flex items-center justify-center mb-3 text-gray-400">
        <Icon size={24} strokeWidth={1.5} />
      </div>
      <h3 className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
        {title}
      </h3>
      <p className="text-xs text-gray-400 dark:text-gray-500 max-w-sm mx-auto">
        {displayDesc}
      </p>
    </div>
  );
};

export interface SystemTableSkeletonProps {
  rows?: number;
  cols?: number;
  columns?: number;
  colSpan?: number;
}

export const SystemTableSkeleton: React.FC<SystemTableSkeletonProps> = ({
  rows = 6,
  cols = 8,
  columns,
  colSpan,
}) => {
  const totalCols = columns ?? colSpan ?? cols;

  return (
    <>
      {Array.from({ length: rows }).map((_, rIdx) => (
        <tr
          key={rIdx}
          className="border-b border-gray-100 dark:border-gray-800 animate-pulse"
        >
          {Array.from({ length: totalCols }).map((_, cIdx) => (
            <td
              key={cIdx}
              className="px-4 py-3 border-l border-gray-200 dark:border-gray-800 first:border-l-0"
            >
              <div
                className="h-3.5 bg-gray-100 dark:bg-gray-800/80 rounded"
                style={{ width: `${50 + ((rIdx * 13 + cIdx * 17) % 45)}%` }}
              />
            </td>
          ))}
        </tr>
      ))}
    </>
  );
};

export interface SystemTrProps {
  children?: ReactNode;
  className?: string;
  onClick?: (e: MouseEvent<HTMLTableRowElement>) => void;
}

export const SystemTr: React.FC<SystemTrProps> = ({
  children,
  className = '',
  onClick,
}) => (
  <tr
    onClick={onClick}
    className={cn(
      'border-b border-gray-100 dark:border-gray-800/80 hover:bg-gray-50/70 dark:hover:bg-[#1e212b]/60 transition-colors',
      onClick ? 'cursor-pointer' : '',
      className,
    )}
  >
    {children}
  </tr>
);
SystemTr.displayName = 'SystemTr';

export interface SystemTheadProps {
  children?: ReactNode;
  className?: string;
}

export const SystemThead: React.FC<SystemTheadProps> = ({
  children,
  className = '',
}) => {
  const childArray = React.Children.toArray(children);
  const hasTr = childArray.some(
    (child) =>
      React.isValidElement(child) &&
      (child.type === 'tr' ||
        child.type === SystemTr ||
        (typeof child.type === 'function' &&
          (child.type.name === 'SystemTr' ||
            (child.type as any).displayName === 'SystemTr'))),
  );

  return (
    <thead
      className={cn(
        'sticky top-0 z-10 bg-gray-50 dark:bg-[#1a1b23] border-b border-gray-200 dark:border-gray-800',
        className,
      )}
    >
      {hasTr ? children : <tr>{children}</tr>}
    </thead>
  );
};

export interface SystemThProps {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  style?: React.CSSProperties;
}

export const SystemTh: React.FC<SystemThProps> = ({
  children,
  className = '',
  align = 'left',
  colSpan,
  style,
}) => (
  <th
    colSpan={colSpan}
    style={style}
    className={cn(
      'px-4 py-3 font-medium text-gray-500 dark:text-gray-400 text-xs border-l border-gray-200 dark:border-gray-800 uppercase tracking-wide first:border-l-0 whitespace-nowrap',
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className,
    )}
  >
    {children}
  </th>
);

export const SystemTbody: React.FC<{ children?: ReactNode }> = ({ children }) => (
  <tbody className="transition-opacity duration-300 relative align-top">
    {children}
  </tbody>
);

export interface SystemTdProps {
  children?: ReactNode;
  className?: string;
  align?: 'left' | 'center' | 'right';
  colSpan?: number;
  onClick?: (e: MouseEvent<HTMLTableCellElement>) => void;
  style?: React.CSSProperties;
  title?: string;
}

export const SystemTd: React.FC<SystemTdProps> = ({
  children,
  className = '',
  align = 'left',
  colSpan,
  onClick,
  style,
  title,
}) => (
  <td
    title={title}
    colSpan={colSpan}
    onClick={onClick}
    style={style}
    className={cn(
      'px-4 py-3 border-l border-gray-200 dark:border-gray-800 text-xs sm:text-sm first:border-l-0 text-gray-800 dark:text-gray-200',
      align === 'center' ? 'text-center' : align === 'right' ? 'text-right' : 'text-left',
      className,
    )}
  >
    {children}
  </td>
);

export interface SystemPaginationProps {
  page?: number;
  currentPage?: number;
  totalPages?: number;
  totalItems: number;
  setPage?: (page: number) => void;
  onPageChange?: (page: number) => void;
  itemsPerPage?: number;
  setItemsPerPage?: (limit: number) => void;
  onLimitChange?: (limit: number) => void;
  className?: string;
}

export const SystemPagination: React.FC<SystemPaginationProps> = ({
  page: _page,
  currentPage,
  totalPages,
  totalItems,
  setPage: _setPage,
  onPageChange,
  itemsPerPage = 20,
  setItemsPerPage,
  onLimitChange,
  className = '',
}) => {
  // Normalize: support both (page/setPage) and (currentPage/onPageChange) API styles
  // Internal page is always 0-indexed
  const rawPage = _page ?? currentPage ?? 0;
  const isOneBased = !!onPageChange || (currentPage !== undefined && _page === undefined);
  const page = isOneBased ? Math.max(0, rawPage - 1) : Math.max(0, rawPage);
  const setPage = (p: number) => {
    if (onPageChange) onPageChange(p + 1);
    else _setPage?.(p);
  };
  const handleLimitChange = (val: number) => {
    if (onLimitChange) onLimitChange(val);
    else setItemsPerPage?.(val);
  };
  const hasLimitControl = !!(setItemsPerPage || onLimitChange);

  // Generate limit options that always include current itemsPerPage so it never shows "Chọn..."
  const currentLimit = Number(itemsPerPage) || 20;
  const effectiveTotalPages = totalPages ?? Math.max(1, Math.ceil(totalItems / currentLimit));
  const standardLimits = [10, 20, 25, 30, 50, 100, 200];
  const allLimits = Array.from(new Set([...standardLimits, currentLimit])).sort(
    (a, b) => a - b,
  );
  const limitOptions = allLimits.map((lim) => ({
    value: lim,
    label: `${lim} dòng/trang`,
  }));

  if (effectiveTotalPages <= 0 && totalItems <= 0) return null;

  return (
    <div
      className={cn(
        'mt-auto flex-shrink-0 flex flex-wrap items-center justify-between gap-2.5 sm:gap-3 px-3.5 sm:px-5 py-2.5 sm:py-3 border-t border-gray-200 dark:border-gray-800 bg-gray-50/50 dark:bg-[#1a1b23]/50',
        className,
      )}
    >
      <div className="flex items-center gap-2 text-xs sm:text-sm text-gray-500 font-normal">
        Trang {page + 1} / {effectiveTotalPages || 1} ·{' '}
        <span className="font-medium text-gray-700 dark:text-gray-300">
          {totalItems} bản ghi
        </span>
      </div>

      <div className="flex items-center gap-3">
        {hasLimitControl && (
          <div className="w-[135px]">
            <Select
              options={limitOptions}
              value={currentLimit}
              placeholder={`${currentLimit} dòng/trang`}
              onChange={(val) => {
                handleLimitChange(Number(val));
                setPage(0);
              }}
              placement="top"
              size="sm"
              className="w-full"
            />
          </div>
        )}

        <div className="flex items-center gap-1">
          <button
            onClick={() => setPage(Math.max(0, page - 1))}
            disabled={page === 0}
            className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setPage(Math.min(effectiveTotalPages - 1, page + 1))}
            disabled={page >= effectiveTotalPages - 1}
            className="w-8 h-8 flex items-center justify-center rounded text-gray-400 hover:text-gray-900 dark:hover:text-white hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};
