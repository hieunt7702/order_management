import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { CheckCircle2, AlertCircle, AlertTriangle, Info, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

export interface ToastItem {
  id: string;
  type: ToastType;
  title: string;
  description?: string;
  duration?: number;
  createdAt: number;
}

export interface ToastOptions {
  id?: string;
  type?: ToastType;
  title: string;
  description?: string;
  duration?: number;
}

type ToastListener = (toasts: ToastItem[]) => void;

class ToastManager {
  private toasts: ToastItem[] = [];
  private listeners: Set<ToastListener> = new Set();

  subscribe(listener: ToastListener) {
    this.listeners.add(listener);
    listener([...this.toasts]);
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const copy = [...this.toasts];
    this.listeners.forEach((listener) => listener(copy));
  }

  show(options: ToastOptions): string {
    const id = options.id || Math.random().toString(36).substring(2, 9);
    const newToast: ToastItem = {
      id,
      type: options.type || 'info',
      title: options.title,
      description: options.description,
      duration: options.duration !== undefined ? options.duration : 4000,
      createdAt: Date.now(),
    };

    // Keep max 5 toasts visible simultaneously
    this.toasts = [newToast, ...this.toasts.filter((t) => t.id !== id)].slice(0, 5);
    this.notify();
    return id;
  }

  dismiss(id: string) {
    this.toasts = this.toasts.filter((t) => t.id !== id);
    this.notify();
  }

  clear() {
    this.toasts = [];
    this.notify();
  }

  success(title: string, description?: string, duration?: number) {
    return this.show({ type: 'success', title, description, duration });
  }

  error(title: string, description?: string, duration?: number) {
    return this.show({ type: 'error', title, description, duration });
  }

  warning(title: string, description?: string, duration?: number) {
    return this.show({ type: 'warning', title, description, duration });
  }

  info(title: string, description?: string, duration?: number) {
    return this.show({ type: 'info', title, description, duration });
  }
}

export const toast = new ToastManager();

interface ToastCardProps {
  toast: ToastItem;
  onDismiss: (id: string) => void;
}

const ToastCard: React.FC<ToastCardProps> = ({ toast: item, onDismiss }) => {
  const [isHovered, setIsHovered] = useState(false);
  const [remainingTime, setRemainingTime] = useState(item.duration || 4000);
  const startTimeRef = useRef<number>(Date.now());
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (item.duration === 0) return; // Never auto-dismiss if duration is 0

    if (!isHovered) {
      startTimeRef.current = Date.now();
      timerRef.current = setTimeout(() => {
        onDismiss(item.id);
      }, remainingTime);
    } else {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        const elapsed = Date.now() - startTimeRef.current;
        setRemainingTime((prev) => Math.max(0, prev - elapsed));
      }
    }

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [isHovered, item.id, item.duration, onDismiss, remainingTime]);

  const icons = {
    success: <CheckCircle2 className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />,
    error: <AlertCircle className="w-5 h-5 text-rose-500 shrink-0 mt-0.5" />,
    warning: <AlertTriangle className="w-5 h-5 text-amber-500 shrink-0 mt-0.5" />,
    info: <Info className="w-5 h-5 text-[#5865f2] shrink-0 mt-0.5" />,
  };

  const borderThemes = {
    success: 'border-emerald-500/30 bg-white/95 dark:bg-[#121a16]/95 shadow-[0_8px_30px_rgb(16,185,129,0.12)]',
    error: 'border-rose-500/30 bg-white/95 dark:bg-[#1a1214]/95 shadow-[0_8px_30px_rgb(244,63,94,0.12)]',
    warning: 'border-amber-500/30 bg-white/95 dark:bg-[#1a1811]/95 shadow-[0_8px_30px_rgb(245,158,11,0.12)]',
    info: 'border-[#5865f2]/30 bg-white/95 dark:bg-[#141624]/95 shadow-[0_8px_30px_rgb(88,101,242,0.12)]',
  };

  const progressColors = {
    success: 'bg-emerald-500',
    error: 'bg-rose-500',
    warning: 'bg-amber-500',
    info: 'bg-[#5865f2]',
  };

  return (
    <div
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      role="alert"
      className={cn(
        'pointer-events-auto rounded border backdrop-blur-md p-3.5 sm:p-4 transition-all duration-300 relative overflow-hidden flex items-start gap-3 select-none text-left',
        'animate-in fade-in slide-in-from-top-3 sm:slide-in-from-right-3 duration-200',
        borderThemes[item.type],
      )}
    >
      {icons[item.type]}

      <div className="flex-1 min-w-0 pr-1">
        <p className="text-xs sm:text-sm font-semibold text-gray-900 dark:text-white leading-tight">
          {item.title}
        </p>
        {item.description && (
          <p className="mt-1 text-[11px] sm:text-xs text-gray-600 dark:text-gray-300 leading-relaxed whitespace-pre-wrap break-words">
            {item.description}
          </p>
        )}
      </div>

      <button
        type="button"
        onClick={() => onDismiss(item.id)}
        className="w-6 h-6 rounded flex items-center justify-center text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors cursor-pointer shrink-0"
        title="Đóng thông báo"
      >
        <X size={14} />
      </button>

      {/* Subtle Progress Bar */}
      {item.duration !== 0 && (
        <div
          className={cn(
            'absolute bottom-0 left-0 right-0 h-0.5 opacity-80 transition-all ease-linear',
            progressColors[item.type],
          )}
          style={{
            animation: `shrinkWidth ${item.duration}ms linear forwards`,
            animationPlayState: isHovered ? 'paused' : 'running',
          }}
        />
      )}
    </div>
  );
};

export const ToastContainer: React.FC = () => {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  useEffect(() => {
    return toast.subscribe((updated) => setToasts(updated));
  }, []);

  if (typeof document === 'undefined' || toasts.length === 0) return null;

  return createPortal(
    <div
      aria-live="polite"
      className="fixed top-4 right-4 z-[99999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-[calc(100vw-32px)] pointer-events-none"
    >
      <style>{`
        @keyframes shrinkWidth {
          from { width: 100%; }
          to { width: 0%; }
        }
      `}</style>
      {toasts.map((t) => (
        <ToastCard key={t.id} toast={t} onDismiss={(id) => toast.dismiss(id)} />
      ))}
    </div>,
    document.body,
  );
};
