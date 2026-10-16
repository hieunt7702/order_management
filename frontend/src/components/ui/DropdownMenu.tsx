import React, {
  useState,
  useRef,
  createContext,
  useContext,
  type ReactNode,
  type HTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import { cn } from '../../lib/utils';
import { useClickOutside } from '../../hooks/useClickOutside';

interface DropdownContextType {
  isOpen: boolean;
  setIsOpen: (open: boolean) => void;
  containerRef: React.RefObject<HTMLDivElement | null>;
  menuRef: React.RefObject<HTMLDivElement | null>;
}

const DropdownContext = createContext<DropdownContextType | null>(null);

const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' ? React.useLayoutEffect : React.useEffect;

export function DropdownMenu({ children }: { children?: ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useClickOutside(() => setIsOpen(false), isOpen, [containerRef, menuRef]);

  return (
    <DropdownContext.Provider value={{ isOpen, setIsOpen, containerRef, menuRef }}>
      <div ref={containerRef} className="relative inline-block text-left">
        {children}
      </div>
    </DropdownContext.Provider>
  );
}

export function DropdownMenuTrigger({
  asChild = false,
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLElement> & { asChild?: boolean }) {
  const context = useContext(DropdownContext);
  if (!context) return null;
  const { isOpen, setIsOpen } = context;

  const handleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsOpen(!isOpen);
  };

  if (asChild && React.isValidElement(children)) {
    return React.cloneElement(children as React.ReactElement<any>, {
      onClick: (e: React.MouseEvent) => {
        (children as React.ReactElement<any>).props?.onClick?.(e);
        handleClick(e);
      },
      'aria-expanded': isOpen,
    });
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      aria-expanded={isOpen}
      className={cn(
        'inline-flex items-center justify-center rounded hover:bg-gray-100 dark:hover:bg-gray-800 text-gray-500 transition-colors cursor-pointer',
        className,
      )}
      {...props}
    >
      {children}
    </button>
  );
}

export function DropdownMenuContent({
  align = 'end',
  side = 'bottom',
  className = '',
  children,
  style,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  align?: 'start' | 'center' | 'end' | 'left' | 'right';
  side?: 'top' | 'bottom';
}) {
  const context = useContext(DropdownContext);
  if (!context) return null;
  const { isOpen, setIsOpen, containerRef, menuRef } = context;

  const [coords, setCoords] = useState<{
    top: number;
    left?: number;
    right?: number;
    transform?: string;
  } | null>(null);

  const updatePosition = React.useCallback(() => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();

    // If trigger element has zero size or is far out of view
    if (rect.bottom < -50 || rect.top > window.innerHeight + 50) {
      setIsOpen(false);
      return;
    }

    const spaceBelow = window.innerHeight - rect.bottom;
    const spaceAbove = rect.top;
    const isFlipped = side === 'top' || (spaceBelow < 220 && spaceAbove > 200);

    const isCenter = align === 'center';
    const isStart = align === 'start' || align === 'left';
    const top = isFlipped ? Math.max(8, rect.top - 6) : rect.bottom + 6;
    const transform = isCenter
      ? isFlipped
        ? 'translate(-50%, -100%)'
        : 'translateX(-50%)'
      : isFlipped
      ? 'translateY(-100%)'
      : 'none';

    let left: number | undefined;
    let right: number | undefined;

    if (isStart) {
      left = Math.max(8, Math.min(rect.left, window.innerWidth - 190));
    } else if (isCenter) {
      left = Math.max(8, Math.min(rect.left + rect.width / 2, window.innerWidth - 8));
    } else {
      // align === 'end' or 'right'
      if (rect.right < 190) {
        left = 8;
      } else {
        right = Math.max(8, window.innerWidth - rect.right);
      }
    }

    setCoords({
      top,
      left,
      right,
      transform,
    });
  }, [align, side, containerRef, setIsOpen]);

  useIsomorphicLayoutEffect(() => {
    if (!isOpen) {
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
  }, [isOpen, updatePosition]);

  if (!isOpen || typeof document === 'undefined') return null;

  return createPortal(
    <div
      ref={menuRef}
      role="menu"
      style={{
        position: 'fixed',
        top: coords ? `${coords.top}px` : undefined,
        left: coords?.left !== undefined ? `${coords.left}px` : undefined,
        right: coords?.right !== undefined ? `${coords.right}px` : undefined,
        transform: coords?.transform,
        zIndex: 9999,
        opacity: coords ? 1 : 0,
        pointerEvents: coords ? 'auto' : 'none',
        ...style,
      }}
      className={cn(
        'min-w-[160px] max-w-[calc(100vw-16px)] sm:max-w-[260px] rounded-lg bg-white dark:bg-[#1a1b23] border border-gray-200 dark:border-gray-800 p-1 text-gray-900 dark:text-gray-100 shadow-xl animate-fade-in outline-none',
        className,
      )}
      onClick={(e) => {
        e.stopPropagation();
      }}
      {...props}
    >
      {children}
    </div>,
    document.body,
  );
}

export function DropdownMenuItem({
  className = '',
  variant = 'default',
  onClick,
  children,
  closeOnClick = true,
  ...props
}: HTMLAttributes<HTMLDivElement> & {
  variant?: 'default' | 'destructive';
  closeOnClick?: boolean;
}) {
  const context = useContext(DropdownContext);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    e.stopPropagation();
    onClick?.(e);
    if (closeOnClick && context?.setIsOpen) {
      context.setIsOpen(false);
    }
  };

  const variantClasses = {
    default:
      'text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-[#262930] hover:text-gray-900 dark:hover:text-white',
    destructive:
      'text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40',
  };

  return (
    <div
      role="menuitem"
      onClick={handleClick}
      className={cn(
        'flex items-center gap-2 px-2.5 py-1.5 text-xs font-normal rounded-md transition-colors cursor-pointer select-none outline-none leading-snug',
        variantClasses[variant] || variantClasses.default,
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}

export function DropdownMenuSeparator({
  className = '',
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      role="separator"
      className={cn('my-1 h-px bg-gray-100 dark:bg-gray-800/80', className)}
      {...props}
    />
  );
}

export function DropdownMenuLabel({
  className = '',
  children,
  ...props
}: HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn(
        'px-2.5 py-1 text-[10px] font-semibold text-gray-400 dark:text-gray-500 uppercase tracking-wider',
        className,
      )}
      {...props}
    >
      {children}
    </div>
  );
}
