import React, { useEffect, useRef, type ReactNode, type ComponentType } from 'react';
import { createPortal } from 'react-dom';
import { X, Loader2 } from 'lucide-react';
import { cn } from '../../lib/utils';

export interface ModalProps {
  isOpen: boolean;
  onClose?: () => void;
  title?: string;
  subtitle?: string;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  children?: ReactNode;
  maxWidth?: string;
  /** Shorthand size: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full' — maps to maxWidth */
  size?: 'sm' | 'md' | 'lg' | 'xl' | '2xl' | '3xl' | 'full';
  className?: string;
  headerRight?: ReactNode;
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
}) => {
  const sizeMap: Record<string, string> = {
    sm: 'max-w-sm',
    md: 'max-w-lg',
    lg: 'max-w-2xl',
    xl: 'max-w-4xl',
    '2xl': 'max-w-6xl',
    '3xl': 'max-w-7xl w-[96vw]',
    full: 'max-w-[96vw] w-[96vw]',
  };
  const resolvedMaxWidth = maxWidth ?? (size ? sizeMap[size] : 'max-w-lg');
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
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/60 dark:bg-black/75 backdrop-blur-[2px] animate-fade-in">
      <div
        className="fixed inset-0 -z-10"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        className={cn(
          'bg-white dark:bg-[#181b22] rounded w-full shadow-2xl border border-gray-200 dark:border-gray-800 overflow-hidden flex flex-col max-h-[92vh] transition-all',
          resolvedMaxWidth,
          className,
        )}
      >
        {/* Modal Header */}
        <div className="px-5 py-3.5 bg-white dark:bg-[#181b22] border-b border-gray-200 dark:border-gray-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            {Icon && (
              <div className="w-8 h-8 rounded bg-[#5865f2]/10 dark:bg-[#5865f2]/20 text-[#5865f2] flex items-center justify-center shrink-0">
                <Icon size={16} strokeWidth={1.5} />
              </div>
            )}
            <div className="min-w-0">
              <h3 className="text-sm sm:text-base font-medium text-gray-900 dark:text-white leading-tight truncate">
                {title}
              </h3>
              {subtitle && (
                <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5 truncate font-normal">
                  {subtitle}
                </p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1.5 shrink-0 ml-3">
            {headerRight}
            <button
              type="button"
              onClick={onClose}
              className="w-7 h-7 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer"
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
      'p-5 overflow-y-auto space-y-4 text-xs sm:text-sm text-gray-700 dark:text-gray-300 custom-scrollbar',
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
      'px-5 py-3 bg-gray-50/50 dark:bg-[#14151a] border-t border-gray-200 dark:border-gray-800 flex items-center justify-end gap-2.5 shrink-0',
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
    'inline-flex items-center justify-center gap-1.5 px-3.5 py-1.5 text-xs sm:text-sm font-medium rounded transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed select-none';

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
