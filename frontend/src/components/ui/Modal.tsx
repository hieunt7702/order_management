import React, { useEffect, useRef, type ReactNode, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: ReactNode;
  subtitle?: ReactNode;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  children?: ReactNode;
  maxWidth?: string;
  /** Shorthand size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' — maps to maxWidth */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  className?: string;
  headerRight?: ReactNode;
  mobilePlacement?: 'bottom' | 'center';
  containerZIndex?: string;
}

export const Modal: React.FC<ModalProps> = ({
  isOpen,
  onClose,
  title,
  subtitle,
  icon: Icon,
  children,
  maxWidth,
  size,
  className = '',
  headerRight = null,
  mobilePlacement = 'bottom',
  containerZIndex = 'z-[70]',
}) => {
  const desktopSizeMap: Record<string, string> = {
    sm: 'lg:max-w-sm',
    md: 'lg:max-w-lg',
    lg: 'lg:max-w-2xl',
    xl: 'lg:max-w-4xl',
    '2xl': 'lg:max-w-6xl',
    '3xl': 'lg:max-w-7xl lg:w-[96vw]',
    full: 'lg:max-w-[96vw] lg:w-[96vw]',
  };

  const customMaxWidthToDesktop: Record<string, string> = {
    'max-w-xs': 'lg:max-w-xs',
    'max-w-sm': 'lg:max-w-sm',
    'max-w-md': 'lg:max-w-md',
    'max-w-lg': 'lg:max-w-lg',
    'max-w-xl': 'lg:max-w-xl',
    'max-w-2xl': 'lg:max-w-2xl',
    'max-w-3xl': 'lg:max-w-3xl',
    'max-w-4xl': 'lg:max-w-4xl',
    'max-w-5xl': 'lg:max-w-5xl',
    'max-w-6xl': 'lg:max-w-6xl',
    'max-w-7xl': 'lg:max-w-7xl',
    'max-w-[96vw]': 'lg:max-w-[96vw]',
    'w-[92vw] max-w-xl': 'lg:max-w-xl lg:w-auto',
    'w-[92vw] max-w-2xl': 'lg:max-w-2xl lg:w-auto',
    'w-[92vw] max-w-4xl': 'lg:max-w-4xl lg:w-auto',
    'w-[94vw] max-w-5xl': 'lg:max-w-5xl lg:w-auto',
    'w-[94vw] max-w-6xl': 'lg:max-w-6xl lg:w-auto',
    'max-w-[96vw] xl:max-w-7xl w-full': 'lg:max-w-[96vw] xl:max-w-7xl lg:w-full',
  };

  const resolveDesktopWidth = (raw: string): string => {
    const trimmed = raw.trim();
    if (customMaxWidthToDesktop[trimmed]) {
      return customMaxWidthToDesktop[trimmed];
    }
    return trimmed
      .split(/\s+/)
      .filter(Boolean)
      .map((token) => {
        if (token.startsWith('max-w-') && !token.startsWith('max-w-full') && !token.includes(':')) {
          return `lg:${token}`;
        }
        if (token.startsWith('w-') && !token.includes(':') && token !== 'w-full') {
          return `lg:${token}`;
        }
        return token;
      })
      .join(' ');
  };

  const desktopWidthClass = maxWidth
    ? resolveDesktopWidth(maxWidth)
    : (size ? desktopSizeMap[size] || 'lg:max-w-lg' : 'lg:max-w-lg');

  // Full width on tablet & mobile (< lg), original max-width restored on PC (>= lg)
  const resolvedMaxWidth = cn('w-full max-w-full', desktopWidthClass);
  const modalRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose?.();
      }
    };
    if (isOpen) {
      document.body.style.overflow = 'hidden';
      window.addEventListener('keydown', handleKeyDown);
    }
    return () => {
      document.body.style.overflow = '';
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return createPortal(
    <div
      className={cn(
        'fixed inset-0 flex items-center justify-center bg-black/60 dark:bg-black/75 backdrop-blur-[2px] animate-modal-backdrop',
        containerZIndex,
        mobilePlacement === 'bottom'
          ? 'flex-col justify-end sm:justify-center p-0 sm:p-4'
          : 'p-2 sm:p-4',
      )}
    >
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={cn(
          'bg-white dark:bg-[#181b22] w-full shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh] max-h-[92dvh] sm:max-h-[90vh]',
          '[&>form]:flex [&>form]:flex-col [&>form]:flex-1 [&>form]:min-h-0 [&>form]:overflow-hidden [&>form]:space-y-0',
          mobilePlacement === 'bottom'
            ? 'rounded-t-2xl sm:rounded-lg rounded-b-none sm:rounded-b border-x-0 sm:border-x border-b-0 sm:border-b max-h-[90vh] max-h-[90dvh] sm:max-h-[90vh] animate-modal-sheet sm:animate-modal-center'
            : 'rounded-xl sm:rounded-lg border animate-modal-center',
          resolvedMaxWidth,
          className,
        )}
      >
        {/* Mobile Drag Indicator Bar */}
        {mobilePlacement === 'bottom' && (
          <div className="sm:hidden pt-2.5 pb-1 bg-white dark:bg-[#181b22] flex justify-center shrink-0">
            <div className="w-10 h-1 bg-gray-300 dark:bg-gray-600 rounded-full" />
          </div>
        )}

        {/* Modal Header */}
        <div className="px-3.5 sm:px-5 py-3 sm:py-3.5 bg-white dark:bg-[#181b22] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded sm:rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center shrink-0">
                <Icon size={16} strokeWidth={1.8} />
              </div>
            )}
            <div className="min-w-0">
              <div className="text-sm sm:text-base font-semibold sm:font-medium text-gray-900 dark:text-white leading-tight truncate">
                {title}
              </div>
              {subtitle && (
                <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-normal">
                  {subtitle}
                </div>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              className="w-8 h-8 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer active:scale-95 shrink-0"
              title="Đóng (Esc)"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        {/* Modal Body & Content */}
        {children}
      </div>
    </div>,
    document.body,
  );
};

export const ModalBody: React.FC<{ children?: ReactNode; className?: string }> = ({
  children,
  className = '',
}) => (
  <div
    className={cn(
      'p-3 sm:p-5 overflow-y-auto space-y-3 sm:space-y-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 custom-scrollbar flex-1 min-h-0 overscroll-contain',
      className,
    )}
  >
    {children}
  </div>
);

export const ModalFooter: React.FC<{
  children?: ReactNode;
  className?: string;
}> = ({ children, className = '' }) => (
  <div
    className={cn(
      'px-3.5 sm:px-5 py-2.5 sm:py-3 pb-[calc(0.75rem+env(safe-area-inset-bottom,0px))] sm:pb-3 bg-gray-50/90 dark:bg-[#14151a] border-t border-gray-200 dark:border-gray-800 flex items-center justify-between sm:justify-end gap-2 sm:gap-2.5 shrink-0 mt-auto z-10',
      className,
    )}
  >
    {children}
  </div>
);

export interface ModalButtonProps {
  variant?: 'secondary' | 'primary' | 'danger' | 'outline';
  type?: 'button' | 'submit' | 'reset';
  onClick?: (e: React.MouseEvent<HTMLButtonElement>) => void;
  disabled?: boolean;
  loading?: boolean;
  children?: ReactNode;
  className?: string;
}

export const ModalButton: React.FC<ModalButtonProps> = ({
  variant = 'secondary',
  type = 'button',
  onClick,
  disabled = false,
  loading = false,
  children,
  className = '',
}) => {
  const baseClasses =
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-2 sm:py-1.5 min-h-[38px] sm:min-h-[32px] text-xs sm:text-sm font-medium rounded sm:rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none active:scale-95';

  const variantClasses = {
    secondary:
      'bg-white dark:bg-[#1a1b23] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262930]',
    outline:
      'bg-white dark:bg-[#1a1b23] text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-gray-700 hover:bg-gray-50 dark:hover:bg-[#262930]',
    primary:
      'bg-[#5865f2] hover:bg-[#4752c4] text-white border-0 shadow-none active:translate-y-px',
    danger:
      'bg-red-500/10 hover:bg-red-500/20 text-red-600 dark:text-red-400 border border-red-200 dark:border-red-900/50 active:translate-y-px',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled || loading}
      className={cn(
        baseClasses,
        variantClasses[variant] || variantClasses.secondary,
        className,
      )}
    >
      {loading && <Loader2 size={14} className="animate-spin" />}
      {children}
    </button>
  );
};
