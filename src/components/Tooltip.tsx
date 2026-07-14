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
  useLayoutEffect(() => {
    if (!open || !coords || !tooltipRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const margin = 12;
    let { top, left } = coords;
    if (rect.left < margin) left += margin - rect.left;
    else if (rect.right > window.innerWidth - margin) left -= rect.right - (window.innerWidth - margin);
    if (rect.top < margin) top += margin - rect.top;
    else if (rect.bottom > window.innerHeight - margin) top -= rect.bottom - (window.innerHeight - margin);
    if (top !== coords.top || left !== coords.left) setCoords({ top, left });
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
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
