import React, { useState, useRef, useEffect, useMemo, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { ChevronDown, Check, Search, X, Plus } from 'lucide-react';
import { useClickOutside } from '../../hooks/useClickOutside';
import { cn } from '../../lib/utils';

export interface SelectOption {
  value: string | number;
  label: string;
  color?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  badge?: string;
  disabled?: boolean;
}

export type RawSelectOption = string | number | SelectOption;

export interface SelectProps {
  options?: RawSelectOption[];
  value?: string | number | null;
  onChange?: (val: any) => void;
  placeholder?: string;
  icon?: ComponentType<{ size?: number; className?: string }>;
  searchable?: boolean;
  size?: 'sm' | 'md' | 'lg';
  disabled?: boolean;
  className?: string;
  triggerClassName?: string;
  menuWidth?: string;
  placement?: 'top' | 'bottom';
  mobileSheet?: boolean;
  usePortal?: boolean;
  emptyAction?: {
    label?: string;
    onClick?: (searchTerm: string) => void;
  } | null;
  footerAction?: {
    label: string;
    icon?: ComponentType<{ size?: number; className?: string }>;
    onClick?: () => void;
  } | null;
}

// Helper hook to detect mobile viewport (< 640px)
const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

const useIsMobile = () => {
  const [isMobile, setIsMobile] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      return window.innerWidth < 640;
    }
    return false;
  });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mql = window.matchMedia('(max-width: 639px)');
    const onChange = (e: MediaQueryListEvent) => setIsMobile(e.matches);
    setIsMobile(mql.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return isMobile;
};

export const Select: React.FC<SelectProps> = ({
  options = [],
  value,
  onChange,
  placeholder = 'Chọn...',
  icon: Icon,
  searchable,
  size = 'md',
  disabled = false,
  className = '',
  triggerClassName = '',
  menuWidth = 'w-full',
  placement = 'bottom',
  mobileSheet = true,
  usePortal = true,
  emptyAction = null,
  footerAction = null,
}) => {
  const [isOpen, setIsOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left: number;
    width: number;
    isFlipped?: boolean;
    maxHeight?: number;
  } | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const sheetRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);
  const isMobile = useIsMobile();

  // Position calculation for desktop portal floating popover
  const updatePosition = React.useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // If trigger element has zero size or is far out of view
    if (rect.bottom < -60 || rect.top > window.innerHeight + 60) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isFlipped =
      placement === 'top' || (spaceBelow < 250 && spaceAbove > spaceBelow);

    const minMenuWidth = 240;
    const triggerWidth = rect.width;
    const targetWidth = Math.max(triggerWidth, minMenuWidth);

    // Keep menu within screen boundaries
    const left = Math.max(8, Math.min(rect.left, window.innerWidth - targetWidth - 8));
    const maxHeight = Math.min(isFlipped ? spaceAbove - 16 : spaceBelow - 16, 420);

    setCoords({
      top: isFlipped ? undefined : rect.bottom + 4,
      bottom: isFlipped ? window.innerHeight - rect.top + 4 : undefined,
      left,
      width: targetWidth,
      isFlipped,
      maxHeight: Math.max(maxHeight, 180),
    });
  }, [placement, setIsOpen]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen || (isMobile && mobileSheet) || !usePortal) {
      setCoords(null);
      return;
    }

    updatePosition();

    const handleScrollOrResize = () => {
      updatePosition();
    };

    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);

    return () => {
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [isOpen, isMobile, mobileSheet, usePortal, updatePosition]);

  // Hook to close automatically whenever clicking outside or pressing Escape
  useClickOutside(() => setIsOpen(false), isOpen, [containerRef, sheetRef]);

  // Lock body scroll when mobile sheet is open
  useEffect(() => {
    if (isOpen && isMobile && mobileSheet) {
      const originalOverflow = document.body.style.overflow;
      document.body.style.overflow = 'hidden';
      return () => {
        document.body.style.overflow = originalOverflow;
      };
    }
  }, [isOpen, isMobile, mobileSheet]);

  // Normalize options array: handles both primitives and objects
  const normalizedOptions: SelectOption[] = useMemo(() => {
    return (options || []).map((opt) => {
      if (typeof opt === 'string' || typeof opt === 'number') {
        return { value: opt, label: String(opt) };
      }
      return {
        value: opt.value,
        label: opt.label || String(opt.value),
        color: opt.color,
        icon: opt.icon,
        badge: opt.badge,
        disabled: opt.disabled,
      };
    });
  }, [options]);

  const selectedOption = normalizedOptions.find(
    (opt) => String(opt.value) === String(value),
  );

  // Determine if search should be enabled
  const isSearchActive =
    searchable !== undefined ? searchable : normalizedOptions.length > 7;

  // Filter options based on search query
  const filteredOptions = useMemo(() => {
    if (!searchTerm.trim()) return normalizedOptions;
    const term = searchTerm.toLowerCase();
    return normalizedOptions.filter(
      (opt) =>
        opt.label.toLowerCase().includes(term) ||
        String(opt.value).toLowerCase().includes(term),
    );
  }, [normalizedOptions, searchTerm]);

  // Auto focus search input when opened
  useEffect(() => {
    if (isOpen && isSearchActive) {
      const timer = setTimeout(() => {
        searchInputRef.current?.focus();
      }, 60);
      return () => clearTimeout(timer);
    } else {
      setSearchTerm('');
    }
  }, [isOpen, isSearchActive]);

  // Sizing tokens for the trigger button
  const sizeClasses = {
    sm: 'h-8 px-2.5 text-xs',
    md: 'h-9 px-3 text-xs sm:text-[13px]',
    lg: 'h-10 px-3.5 text-sm',
  };

  const handleSelect = (val: string | number, e?: React.SyntheticEvent) => {
    if (e) {
      e.stopPropagation();
    }
    onChange?.(val);
    setTimeout(() => {
      setIsOpen(false);
    }, 60);
  };

  const ActiveIcon = selectedOption?.icon || Icon;

  const renderDesktopMenuContent = () => (
    <>
      {/* Search Box if enabled */}
      {isSearchActive && (
        <div className="p-2 border-b border-gray-100 dark:border-gray-800 bg-gray-50/70 dark:bg-[#141822]">
          <div className="relative">
            <Search
              size={13}
              className="absolute left-2.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              ref={searchInputRef}
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="Tìm kiếm..."
              className="w-full pl-8 pr-7 py-1.5 text-xs rounded bg-white dark:bg-[#1b202c] border border-gray-200 dark:border-gray-700 text-gray-800 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#5865f2]"
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
              >
                <X size={12} />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Options List */}
      <ul className="flex-1 overflow-y-auto custom-scrollbar py-1 divide-y divide-gray-50 dark:divide-gray-800/40">
        {filteredOptions.length === 0 ? (
          <li className="px-3 py-4 text-center space-y-2">
            <p className="text-xs text-gray-400 font-normal">
              {searchTerm
                ? `Không tìm thấy "${searchTerm}"`
                : 'Không tìm thấy kết quả'}
            </p>
            {emptyAction && (
              <button
                type="button"
                onClick={() => {
                  emptyAction.onClick?.(searchTerm);
                  setIsOpen(false);
                }}
                className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-semibold text-white bg-[#5865f2] hover:bg-[#4752c4] rounded shadow-xs cursor-pointer transition-all"
              >
                <Plus size={13} />
                {emptyAction.label || 'Thêm mới nhanh'}
              </button>
            )}
          </li>
        ) : (
          filteredOptions.map((opt) => {
            const isSelected = String(opt.value) === String(value);
            const OptIcon = opt.icon;
            return (
              <li
                key={String(opt.value)}
                onClick={(e) => {
                  e.stopPropagation();
                  if (!opt.disabled) handleSelect(opt.value, e);
                }}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
                className={`px-3 py-2 text-xs flex items-center justify-between gap-2 transition-colors select-none font-normal
                  ${
                    opt.disabled
                      ? 'opacity-40 cursor-not-allowed text-gray-400'
                      : 'cursor-pointer hover:bg-indigo-50/60 dark:hover:bg-[#222838]'
                  }
                  ${
                    isSelected
                      ? 'bg-indigo-50/90 dark:bg-indigo-950/40 text-[#5865f2] dark:text-indigo-400 font-normal'
                      : 'text-gray-700 dark:text-gray-200 font-normal'
                  }
                `}
              >
                <div className="flex items-center gap-2 truncate min-w-0">
                  {opt.color && (
                    <span
                      className="w-2.5 h-2.5 rounded-full shrink-0"
                      style={{ backgroundColor: opt.color }}
                    />
                  )}
                  {OptIcon && (
                    <OptIcon
                      size={13}
                      className="shrink-0 text-gray-400"
                    />
                  )}
                  <span className="truncate">{opt.label}</span>
                </div>

                <div className="flex items-center gap-1.5 shrink-0">
                  {opt.badge && (
                    <span className="text-[10px] px-1.5 py-0.2 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">
                      {opt.badge}
                    </span>
                  )}
                  {isSelected && (
                    <Check
                      size={14}
                      className="text-[#5865f2] dark:text-indigo-400 shrink-0"
                    />
                  )}
                </div>
              </li>
            );
          })
        )}
      </ul>

      {/* Desktop Footer Action */}
      {footerAction && (
        <div className="p-1.5 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-[#141822]">
          <button
            type="button"
            onClick={() => {
              footerAction.onClick?.();
              setIsOpen(false);
            }}
            className="w-full py-1.5 px-2 flex items-center justify-center gap-1 text-xs font-semibold text-[#5865f2] dark:text-indigo-400 hover:bg-[#5865f2]/10 rounded transition-colors cursor-pointer"
          >
            {footerAction.icon ? (
              <footerAction.icon size={13} />
            ) : (
              <Plus size={13} />
            )}
            <span>{footerAction.label}</span>
          </button>
        </div>
      )}
    </>
  );

  return (
    <div className={`relative inline-block ${className || 'w-full'}`} ref={containerRef}>
      {/* Trigger Button */}
      <button
        type="button"
        disabled={disabled}
        onClick={(e) => {
          e.stopPropagation();
          if (!disabled) setIsOpen(!isOpen);
        }}
        className={cn(
          'w-full flex items-center justify-between gap-2 rounded bg-white dark:bg-[#161b26] border border-gray-200 dark:border-gray-700/80 text-gray-800 dark:text-gray-100 font-normal transition-all cursor-pointer select-none',
          'hover:border-[#5865f2]/50 hover:bg-gray-50/50 dark:hover:bg-[#1c2230]',
          'focus:outline-none focus:ring-2 focus:ring-[#5865f2]/20 focus:border-[#5865f2]',
          'disabled:opacity-50 disabled:cursor-not-allowed disabled:bg-gray-100 dark:disabled:bg-gray-800',
          sizeClasses[size] || sizeClasses.md,
          isOpen && 'border-[#5865f2] ring-2 ring-[#5865f2]/20',
          triggerClassName,
        )}
      >
        {/* Left icon & label */}
        <div className="flex items-center gap-2 truncate min-w-0 font-normal">
          {ActiveIcon && (
            <ActiveIcon size={14} className="text-[#5865f2] shrink-0" />
          )}
          {selectedOption?.color && (
            <span
              className="w-2.5 h-2.5 rounded-full shrink-0"
              style={{ backgroundColor: selectedOption.color }}
            />
          )}
          <span className="truncate leading-none font-normal">
            {selectedOption ? (
              selectedOption.label
            ) : (
              <span className="text-gray-400 font-normal">{placeholder}</span>
            )}
          </span>
        </div>

        {/* Chevron */}
        <ChevronDown
          size={14}
          className={`text-gray-400 dark:text-gray-500 transition-transform duration-200 shrink-0 ${
            isOpen
              ? placement === 'top' && !isMobile
                ? 'rotate-0'
                : 'rotate-180 text-[#5865f2]'
              : ''
          }`}
        />
      </button>

      {/* MOBILE BOTTOM SHEET */}
      {isOpen &&
        isMobile &&
        mobileSheet &&
        createPortal(
          <div className="fixed inset-0 z-[100] flex flex-col justify-end select-none pointer-events-auto">
            {/* Dark Backdrop */}
            <div
              className="fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-200 animate-fade-in cursor-pointer"
              onClick={(e) => {
                e.stopPropagation();
                setIsOpen(false);
              }}
            />

            {/* Bottom Sheet Drawer */}
            <div
              ref={sheetRef}
              onClick={(e) => e.stopPropagation()}
              onMouseDown={(e) => e.stopPropagation()}
              onTouchStart={(e) => e.stopPropagation()}
              onTouchEnd={(e) => e.stopPropagation()}
              className="relative z-10 w-full max-h-[85vh] bg-white dark:bg-[#161b26] border-t border-gray-200 dark:border-gray-700/80 rounded-t shadow-[0_-12px_40px_rgba(0,0,0,0.5)] flex flex-col overflow-hidden animate-slide-up"
              style={{
                paddingBottom:
                  'calc(1.25rem + env(safe-area-inset-bottom, 0px))',
              }}
            >
              {/* Top Drag Handle & Title Header */}
              <div className="w-full pt-3 pb-2.5 flex flex-col items-center border-b border-gray-100 dark:border-gray-800 bg-gray-50/80 dark:bg-[#121620]">
                <div className="w-12 h-1 bg-gray-300 dark:bg-gray-600 rounded-full mb-2.5" />
                <div className="w-full px-4 flex items-center justify-between">
                  <div className="flex items-center gap-2 truncate pr-2">
                    {ActiveIcon && (
                      <ActiveIcon
                        size={16}
                        className="text-[#5865f2] shrink-0"
                      />
                    )}
                    <span className="font-normal text-sm text-gray-900 dark:text-white truncate">
                      {placeholder || 'Lựa chọn'}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setIsOpen(false)}
                    className="w-7 h-7 flex items-center justify-center rounded-full text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 bg-gray-200/60 dark:bg-gray-700/60 transition-colors"
                  >
                    <X size={15} />
                  </button>
                </div>
              </div>

              {/* Search Input if active */}
              {isSearchActive && (
                <div className="p-3 border-b border-gray-100 dark:border-gray-800 bg-gray-50/40 dark:bg-[#141822]">
                  <div className="relative">
                    <Search
                      size={15}
                      className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
                    />
                    <input
                      ref={searchInputRef}
                      type="text"
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      placeholder="Tìm kiếm..."
                      className="w-full pl-9 pr-8 py-2 text-sm font-normal rounded bg-white dark:bg-[#1a202c] border border-gray-200 dark:border-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 focus:outline-none focus:border-[#5865f2]"
                    />
                    {searchTerm && (
                      <button
                        type="button"
                        onClick={() => setSearchTerm('')}
                        className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-200 p-1"
                      >
                        <X size={14} />
                      </button>
                    )}
                  </div>
                </div>
              )}

              {/* Options List for Mobile */}
              <ul className="flex-1 overflow-y-auto custom-scrollbar py-1.5 divide-y divide-gray-100/70 dark:divide-gray-800/40">
                {filteredOptions.length === 0 ? (
                  <li className="px-4 py-8 text-center space-y-3">
                    <p className="text-xs text-gray-400 font-normal">
                      {searchTerm
                        ? `Không tìm thấy "${searchTerm}"`
                        : 'Không tìm thấy kết quả'}
                    </p>
                    {emptyAction && (
                      <button
                        type="button"
                        onClick={() => {
                          emptyAction.onClick?.(searchTerm);
                          setIsOpen(false);
                        }}
                        className="inline-flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold text-white bg-[#5865f2] hover:bg-[#4752c4] rounded shadow-xs cursor-pointer active:scale-95 transition-all"
                      >
                        <Plus size={14} />
                        {emptyAction.label || 'Thêm mới nhanh'}
                      </button>
                    )}
                  </li>
                ) : (
                  filteredOptions.map((opt) => {
                    const isSelected = String(opt.value) === String(value);
                    const OptIcon = opt.icon;
                    return (
                      <li
                        key={String(opt.value)}
                        onClick={(e) => {
                          e.stopPropagation();
                          if (!opt.disabled) handleSelect(opt.value, e);
                        }}
                        onMouseDown={(e) => e.stopPropagation()}
                        onTouchStart={(e) => e.stopPropagation()}
                        onTouchEnd={(e) => e.stopPropagation()}
                        className={`px-4 py-3 text-sm flex items-center justify-between gap-2.5 transition-colors cursor-pointer select-none font-normal
                          ${
                            opt.disabled
                              ? 'opacity-40 cursor-not-allowed text-gray-400'
                              : 'hover:bg-indigo-50/60 dark:hover:bg-[#1e2433] active:bg-indigo-100/60 dark:active:bg-[#252c3d]'
                          }
                          ${
                            isSelected
                              ? 'bg-indigo-50/90 dark:bg-indigo-950/50 text-[#5865f2] dark:text-indigo-400 font-normal'
                              : 'text-gray-700 dark:text-gray-200 font-normal'
                          }
                        `}
                      >
                        <div className="flex items-center gap-2.5 truncate min-w-0">
                          {opt.color && (
                            <span
                              className="w-3 h-3 rounded-full shrink-0"
                              style={{ backgroundColor: opt.color }}
                            />
                          )}
                          {OptIcon && (
                            <OptIcon
                              size={16}
                              className={`shrink-0 ${
                                isSelected ? 'text-[#5865f2]' : 'text-gray-400'
                              }`}
                            />
                          )}
                          <span className="truncate">{opt.label}</span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          {opt.badge && (
                            <span className="text-[11px] px-1.5 py-0.5 rounded bg-gray-100 dark:bg-gray-800 text-gray-500 font-semibold">
                              {opt.badge}
                            </span>
                          )}
                          {isSelected && (
                            <Check
                              size={16}
                              className="text-[#5865f2] dark:text-indigo-400 shrink-0"
                            />
                          )}
                        </div>
                      </li>
                    );
                  })
                )}
              </ul>

              {/* Mobile Footer Action */}
              {footerAction && (
                <div className="p-2 border-t border-gray-100 dark:border-gray-800 bg-gray-50/60 dark:bg-[#121620]">
                  <button
                    type="button"
                    onClick={() => {
                      footerAction.onClick?.();
                      setIsOpen(false);
                    }}
                    className="w-full py-2 px-3 flex items-center justify-center gap-1.5 text-xs font-semibold text-[#5865f2] dark:text-indigo-400 hover:bg-[#5865f2]/10 rounded transition-colors cursor-pointer"
                  >
                    {footerAction.icon ? (
                      <footerAction.icon size={14} />
                    ) : (
                      <Plus size={14} />
                    )}
                    <span>{footerAction.label}</span>
                  </button>
                </div>
              )}
            </div>
          </div>,
          document.body,
        )}

      {/* DESKTOP POPOVER MENU */}
      {isOpen && (!isMobile || !mobileSheet) && (
        usePortal ? (
          typeof document !== 'undefined' ? (
            createPortal(
              <div
                ref={sheetRef}
                style={{
                  position: 'fixed',
                  top: coords?.top !== undefined ? `${coords.top}px` : undefined,
                  bottom: coords?.bottom !== undefined ? `${coords.bottom}px` : undefined,
                  left: coords?.left !== undefined ? `${coords.left}px` : undefined,
                  width: coords?.width !== undefined ? `${coords.width}px` : undefined,
                  maxWidth: 'calc(100vw - 16px)',
                  maxHeight: coords?.maxHeight !== undefined ? `${coords.maxHeight}px` : 'min(460px, 80vh)',
                  zIndex: 9999,
                  opacity: coords ? 1 : 0,
                  pointerEvents: coords ? 'auto' : 'none',
                }}
                className={`
                  bg-white dark:bg-[#181d28] border border-gray-200 dark:border-gray-700/80
                  rounded shadow-2xl overflow-hidden flex flex-col
                  animate-fade-in
                  ${menuWidth && menuWidth !== 'w-full' ? menuWidth : ''}
                `}
                onClick={(e) => e.stopPropagation()}
                onMouseDown={(e) => e.stopPropagation()}
                onTouchStart={(e) => e.stopPropagation()}
                onTouchEnd={(e) => e.stopPropagation()}
              >
                {renderDesktopMenuContent()}
              </div>,
              document.body,
            )
          ) : null
        ) : (
          <div
            ref={sheetRef}
            onClick={(e) => e.stopPropagation()}
            onMouseDown={(e) => e.stopPropagation()}
            onTouchStart={(e) => e.stopPropagation()}
            onTouchEnd={(e) => e.stopPropagation()}
            className={`
              absolute z-50 min-w-[180px] ${menuWidth}
              bg-white dark:bg-[#181d28] border border-gray-200 dark:border-gray-700/80
              rounded shadow-2xl overflow-hidden flex flex-col
              animate-fade-in
              ${
                placement === 'top'
                  ? 'bottom-full mb-1.5'
                  : 'top-full mt-1.5 left-0'
              }
            `}
            style={{ maxHeight: 'min(460px, 80vh)' }}
          >
            {renderDesktopMenuContent()}
          </div>
        )
      )}
    </div>
  );
};
