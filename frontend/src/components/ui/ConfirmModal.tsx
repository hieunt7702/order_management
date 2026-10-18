import React, { useState, useEffect, type ReactNode, type ComponentType } from 'react';
import {
  AlertTriangle,
  Trash2,
  HelpCircle,
  AlertCircle,
  X,
  Loader2,
} from 'lucide-react';
import { Modal, ModalBody, ModalFooter, ModalButton } from './Modal';
import { cn } from '../../lib/utils';

export type ConfirmVariant = 'danger' | 'warning' | 'primary';

export interface ConfirmOptions {
  id?: string;
  title?: ReactNode;
  subtitle?: ReactNode;
  message: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  containerZIndex?: string;
}

interface ActiveConfirm extends ConfirmOptions {
  id: string;
  resolve: (value: boolean) => void;
  isLoading?: boolean;
}

type ConfirmListener = (active: ActiveConfirm | null) => void;

class ConfirmManager {
  private active: ActiveConfirm | null = null;
  private listeners: Set<ConfirmListener> = new Set();

  subscribe(listener: ConfirmListener) {
    this.listeners.add(listener);
    listener(this.active);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    this.listeners.forEach((listener) => listener(this.active));
  }

  confirm(options: ConfirmOptions): Promise<boolean> {
    return new Promise<boolean>((resolve) => {
      // If there was an existing active confirm, reject/cancel it first
      if (this.active) {
        this.active.resolve(false);
      }

      this.active = {
        ...options,
        id: options.id || Math.random().toString(36).substring(2, 9),
        resolve: (value: boolean) => {
          resolve(value);
          this.active = null;
          this.notify();
        },
      };

      this.notify();
    });
  }

  close() {
    if (this.active) {
      this.active.resolve(false);
    }
  }
}

export const confirmManager = new ConfirmManager();

/**
 * Imperative confirm dialog function
 * Returns a promise that resolves to true if confirmed, false if cancelled.
 *
 * Example:
 * ```ts
 * const ok = await confirmModal({
 *   title: 'Hủy phiếu chi',
 *   message: 'Bạn có chắc chắn muốn hủy phiếu chi này?',
 *   variant: 'danger',
 * });
 * if (!ok) return;
 * ```
 */
export function confirmModal(options: ConfirmOptions): Promise<boolean> {
  return confirmManager.confirm(options);
}

/**
 * Global Container that renders the active confirm dialog.
 * Mount this once in App.tsx alongside ToastContainer.
 */
export const ConfirmModalContainer: React.FC = () => {
  const [active, setActive] = useState<ActiveConfirm | null>(null);

  useEffect(() => {
    return confirmManager.subscribe((item) => {
      setActive(item);
    });
  }, []);

  if (!active) return null;

  const variant = active.variant || 'danger';

  // Determine icon based on variant
  const IconComponent =
    active.icon ||
    (variant === 'danger'
      ? Trash2
      : variant === 'warning'
      ? AlertTriangle
      : HelpCircle);

  const iconBgClasses = {
    danger: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    primary: 'bg-[#5865f2]/10 dark:bg-[#5865f2]/20 text-[#5865f2]',
  };

  const confirmBtnClasses = {
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border-0 shadow-xs active:scale-95 font-medium',
    warning:
      'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border-0 shadow-xs active:scale-95 font-medium',
    primary:
      'bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white border-0 shadow-xs active:scale-95 font-medium',
  };

  const defaultTitle =
    variant === 'danger'
      ? 'Xác nhận xóa'
      : variant === 'warning'
      ? 'Cảnh báo xác nhận'
      : 'Xác nhận thao tác';

  const defaultConfirmText =
    variant === 'danger'
      ? 'Xác nhận xóa'
      : 'Xác nhận';

  return (
    <Modal
      isOpen={!!active}
      onClose={() => active.resolve(false)}
      title={active.title || defaultTitle}
      subtitle={active.subtitle}
      icon={IconComponent}
      size="sm"
      containerZIndex={active.containerZIndex || 'z-[100]'}
    >
      <ModalBody className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              iconBgClasses[variant],
            )}
          >
            <IconComponent size={18} strokeWidth={2} />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
              {active.message}
            </div>

            {active.description && (
              <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-normal">
                {active.description}
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-end gap-2.5 w-full">
        <ModalButton
          type="button"
          variant="secondary"
          onClick={() => active.resolve(false)}
          className="px-4 py-2 text-xs font-semibold"
        >
          {active.cancelText || 'Hủy'}
        </ModalButton>

        <button
          type="button"
          onClick={() => active.resolve(true)}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] sm:min-h-[32px] text-xs font-semibold rounded transition-all cursor-pointer select-none',
            confirmBtnClasses[variant],
          )}
          autoFocus
        >
          {active.confirmText || defaultConfirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};

export interface DeclarativeConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void | Promise<void>;
  title?: ReactNode;
  subtitle?: ReactNode;
  message: ReactNode;
  description?: ReactNode;
  confirmText?: string;
  cancelText?: string;
  variant?: ConfirmVariant;
  icon?: ComponentType<{ size?: number; strokeWidth?: number; className?: string }>;
  loading?: boolean;
  containerZIndex?: string;
}

/**
 * Declarative component if you prefer JSX state over imperative confirmModal
 */
export const ConfirmModal: React.FC<DeclarativeConfirmModalProps> = ({
  isOpen,
  onClose,
  onConfirm,
  title,
  subtitle,
  message,
  description,
  confirmText,
  cancelText = 'Hủy',
  variant = 'danger',
  icon,
  loading = false,
  containerZIndex = 'z-[90]',
}) => {
  if (!isOpen) return null;

  const IconComponent =
    icon ||
    (variant === 'danger'
      ? Trash2
      : variant === 'warning'
      ? AlertTriangle
      : HelpCircle);

  const iconBgClasses = {
    danger: 'bg-rose-500/10 dark:bg-rose-500/20 text-rose-600 dark:text-rose-400',
    warning: 'bg-amber-500/10 dark:bg-amber-500/20 text-amber-600 dark:text-amber-400',
    primary: 'bg-[#5865f2]/10 dark:bg-[#5865f2]/20 text-[#5865f2]',
  };

  const confirmBtnClasses = {
    danger:
      'bg-rose-600 hover:bg-rose-700 active:bg-rose-800 text-white border-0 shadow-xs active:scale-95 font-medium',
    warning:
      'bg-amber-600 hover:bg-amber-700 active:bg-amber-800 text-white border-0 shadow-xs active:scale-95 font-medium',
    primary:
      'bg-[#5865f2] hover:bg-[#4752c4] active:bg-[#3c45a5] text-white border-0 shadow-xs active:scale-95 font-medium',
  };

  const defaultTitle =
    variant === 'danger'
      ? 'Xác nhận xóa'
      : variant === 'warning'
      ? 'Cảnh báo xác nhận'
      : 'Xác nhận thao tác';

  const defaultConfirmText =
    variant === 'danger'
      ? 'Xác nhận xóa'
      : 'Xác nhận';

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={title || defaultTitle}
      subtitle={subtitle}
      icon={IconComponent}
      size="sm"
      containerZIndex={containerZIndex}
    >
      <ModalBody className="p-4 sm:p-5 space-y-3">
        <div className="flex items-start gap-3">
          <div
            className={cn(
              'w-9 h-9 rounded-full flex items-center justify-center shrink-0 mt-0.5',
              iconBgClasses[variant],
            )}
          >
            <IconComponent size={18} strokeWidth={2} />
          </div>

          <div className="flex-1 min-w-0 space-y-1.5 pt-0.5">
            <div className="text-xs sm:text-sm font-medium text-gray-900 dark:text-white leading-relaxed">
              {message}
            </div>

            {description && (
              <div className="text-[11px] sm:text-xs text-gray-500 dark:text-gray-400 leading-normal">
                {description}
              </div>
            )}
          </div>
        </div>
      </ModalBody>

      <ModalFooter className="flex items-center justify-end gap-2.5 w-full">
        <ModalButton
          type="button"
          variant="secondary"
          onClick={onClose}
          disabled={loading}
          className="px-4 py-2 text-xs font-semibold"
        >
          {cancelText}
        </ModalButton>

        <button
          type="button"
          onClick={onConfirm}
          disabled={loading}
          className={cn(
            'inline-flex items-center justify-center gap-1.5 px-4 py-2 min-h-[38px] sm:min-h-[32px] text-xs font-semibold rounded transition-all cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed',
            confirmBtnClasses[variant],
          )}
          autoFocus
        >
          {loading && <Loader2 size={13} className="animate-spin" />}
          {confirmText || defaultConfirmText}
        </button>
      </ModalFooter>
    </Modal>
  );
};
