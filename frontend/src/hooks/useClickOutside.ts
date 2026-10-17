import { useEffect, useRef, type RefObject } from 'react';

type ClickOutsideRef = RefObject<HTMLElement | null> | RefObject<HTMLElement | null>[];

/**
 * Universal hook to detect clicks outside a referenced element and close dropdowns/menus.
 * Supports capture phase mousedown, touchstart, and Escape key.
 */
export const useClickOutside = <T extends HTMLElement = HTMLElement>(
  handler: (event: MouseEvent | TouchEvent | KeyboardEvent) => void,
  active = true,
  externalRef: ClickOutsideRef | null = null,
): RefObject<T | null> => {
  const internalRef = useRef<T | null>(null);
  const ref = (externalRef || internalRef) as any;
  const savedHandler = useRef(handler);
  const refHolder = useRef(ref);
  // Keep refs immediately fresh on every render synchronously
  refHolder.current = ref;
  savedHandler.current = handler;

  useEffect(() => {
    savedHandler.current = handler;
  }, [handler]);

  useEffect(() => {
    refHolder.current = ref;
  }, [ref]);

  useEffect(() => {
    if (!active) return;

    const handleClickOutside = (event: MouseEvent | TouchEvent) => {
      const currentRef = refHolder.current;
      if (!currentRef) return;

      const target = event.target as Node | null;
      if (!target) return;
      const path = event.composedPath ? event.composedPath() : [];

      const refList = Array.isArray(currentRef) ? currentRef : [currentRef];
      const isInside = refList.some((r: any) => {
        const el = r?.current;
        return el && (el === target || el.contains(target) || path.includes(el));
      });

      if (isInside) {
        return;
      }

      savedHandler.current?.(event);
    };

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        savedHandler.current?.(event);
      }
    };

    document.addEventListener('mousedown', handleClickOutside, true);
    document.addEventListener('touchend', handleClickOutside, true);
    window.addEventListener('keydown', handleKeyDown);

    return () => {
      document.removeEventListener('mousedown', handleClickOutside, true);
      document.removeEventListener('touchend', handleClickOutside, true);
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [active]);

  return Array.isArray(ref) ? ref[0] : ref;
};
