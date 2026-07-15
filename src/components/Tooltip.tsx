'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

type Side = 'top' | 'bottom' | 'left' | 'right';

const TRANSLATE: Record<Side, string> = {
  top: 'translate(-50%, -100%)',
  bottom: 'translate(-50%, 0%)',
  left: 'translate(-100%, -50%)',
  right: 'translate(0%, -50%)',
};

const OFFSET: Record<Side, { x: number; y: number }> = {
  top: { x: 0, y: -8 },
  bottom: { x: 0, y: 8 },
  left: { x: -8, y: 0 },
  right: { x: 8, y: 0 },
};

// Arrow sits on the edge of the tooltip facing the anchor — opposite the side
// the tooltip is placed on (a "top" tooltip's arrow points down, etc).
const ARROW_POSITION: Record<Side, string> = {
  top: 'bottom-[-4px] left-1/2 -translate-x-1/2',
  bottom: 'top-[-4px] left-1/2 -translate-x-1/2',
  left: 'right-[-4px] top-1/2 -translate-y-1/2',
  right: 'left-[-4px] top-1/2 -translate-y-1/2',
};

export default function Tooltip({
  content,
  children,
  side = 'top',
  className = 'inline-flex',
}: {
  content?: string;
  children: React.ReactNode;
  side?: Side;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [coords, setCoords] = useState<{ top: number; left: number } | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);

  // Clamp to the viewport after the tooltip renders — near a screen edge, the
  // centered/anchored position from show() can push part of it off-screen.
  // Uses a single min/max clamp per axis (not competing if/else branches) so
  // it always converges to one deterministic position, even when the tooltip
  // is wider/taller than the available space — two independent "shift left"
  // vs "shift right" checks can otherwise undo each other forever and blow
  // React's update-depth limit.
  useLayoutEffect(() => {
    if (!open || !coords || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const margin = 12;

    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const clampedRectLeft = Math.min(Math.max(rect.left, margin), maxLeft);
    const clampedRectTop = Math.min(Math.max(rect.top, margin), maxTop);

    const deltaLeft = clampedRectLeft - rect.left;
    const deltaTop = clampedRectTop - rect.top;

    if (Math.abs(deltaLeft) > 0.5 || Math.abs(deltaTop) > 0.5) {
      setCoords(c => (c ? { top: c.top + deltaTop, left: c.left + deltaLeft } : c));
    }
  }, [open, coords]);

  if (!content) return <>{children}</>;

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    const offset = OFFSET[side];
    const anchor = {
      top: side === 'top' ? rect.top : side === 'bottom' ? rect.bottom : rect.top + rect.height / 2,
      left: side === 'left' ? rect.left : side === 'right' ? rect.right : rect.left + rect.width / 2,
    };
    setCoords({ top: anchor.top + offset.y, left: anchor.left + offset.x });
    setOpen(true);
  };
  const hide = () => setOpen(false);

  return (
    <span
      ref={ref}
      onMouseEnter={show}
      onMouseLeave={hide}
      onFocus={show}
      onBlur={hide}
      className={className}
    >
      {children}
      {typeof document !== 'undefined' && createPortal(
        <AnimatePresence>
          {open && coords && (
            <motion.span
              ref={tooltipRef}
              role="tooltip"
              initial={{ opacity: 0, scale: 0.92 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.92 }}
              transition={{ duration: 0.12, ease: 'easeOut' }}
              style={{ position: 'fixed', top: coords.top, left: coords.left, transform: TRANSLATE[side] }}
              className="z-[100] pointer-events-none max-w-[260px] px-2.5 py-1.5 rounded-lg bg-gray-900/95 dark:bg-navy-800/95 backdrop-blur-sm text-white text-[11px] font-semibold leading-snug shadow-lg ring-1 ring-black/5 dark:ring-white/10 whitespace-normal break-words"
            >
              {content}
              <span
                aria-hidden
                className={`absolute w-2 h-2 rotate-45 bg-gray-900/95 dark:bg-navy-800/95 ${ARROW_POSITION[side]}`}
              />
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
