'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';

type Side = 'top' | 'bottom' | 'left' | 'right';

const OPPOSITE: Record<Side, Side> = {
  top: 'bottom',
  bottom: 'top',
  left: 'right',
  right: 'left',
};

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
// the tooltip is placed on (a "top" tooltip's arrow points down, etc). Only the
// perpendicular edge is fixed by class; the position along that edge is set via
// inline style so the arrow can be nudged back toward the anchor when the box
// itself gets shifted by the viewport clamp below.
const ARROW_EDGE: Record<Side, string> = {
  top: 'bottom-[-4px]',
  bottom: 'top-[-4px]',
  left: 'right-[-4px]',
  right: 'left-[-4px]',
};

function anchorFor(side: Side, rect: DOMRect) {
  return {
    top: side === 'top' ? rect.top : side === 'bottom' ? rect.bottom : rect.top + rect.height / 2,
    left: side === 'left' ? rect.left : side === 'right' ? rect.right : rect.left + rect.width / 2,
  };
}

function coordsFor(anchor: { top: number; left: number }, side: Side) {
  const offset = OFFSET[side];
  return { top: anchor.top + offset.y, left: anchor.left + offset.x };
}

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
  const [effectiveSide, setEffectiveSide] = useState<Side>(side);
  const [arrowOffset, setArrowOffset] = useState<number | null>(null);
  const ref = useRef<HTMLSpanElement>(null);
  const tooltipRef = useRef<HTMLSpanElement>(null);
  const anchorRef = useRef<{ top: number; left: number } | null>(null);
  const flippedRef = useRef(false);

  // Two passes after the tooltip renders, since neither can be judged until
  // its real size is known:
  //
  // 1. Flip — if the box overflows the viewport in the direction it opens
  //    (a "top" tooltip poking above the top edge), there's no room on the
  //    preferred side at all, so re-anchor it to the opposite side instead
  //    of merely nudging it (which would just cover the anchor). Runs once
  //    per show() to avoid oscillating.
  // 2. Clamp — pull the box back onscreen if it still overhangs an edge, and
  //    re-aim the arrow (fixed at the box's center by default) at the true
  //    anchor position, clamped to the box's own edges, so it doesn't drift
  //    away from the element it's meant to point to once the box has moved.
  useLayoutEffect(() => {
    if (!open || !coords || !tooltipRef.current || !anchorRef.current) return;
    const rect = tooltipRef.current.getBoundingClientRect();
    const margin = 12;

    if (!flippedRef.current) {
      const overflowsPreferredSide =
        effectiveSide === 'top' ? rect.top < margin :
        effectiveSide === 'bottom' ? rect.bottom > window.innerHeight - margin :
        effectiveSide === 'left' ? rect.left < margin :
        rect.right > window.innerWidth - margin;

      if (overflowsPreferredSide) {
        const triggerRect = ref.current?.getBoundingClientRect();
        if (triggerRect) {
          const nextSide = OPPOSITE[effectiveSide];
          const anchor = anchorFor(nextSide, triggerRect);
          flippedRef.current = true;
          anchorRef.current = anchor;
          setEffectiveSide(nextSide);
          setCoords(coordsFor(anchor, nextSide));
          return;
        }
      }
    }

    const maxLeft = Math.max(margin, window.innerWidth - rect.width - margin);
    const maxTop = Math.max(margin, window.innerHeight - rect.height - margin);
    const clampedRectLeft = Math.min(Math.max(rect.left, margin), maxLeft);
    const clampedRectTop = Math.min(Math.max(rect.top, margin), maxTop);

    const deltaLeft = clampedRectLeft - rect.left;
    const deltaTop = clampedRectTop - rect.top;

    if (Math.abs(deltaLeft) > 0.5 || Math.abs(deltaTop) > 0.5) {
      setCoords(c => (c ? { top: c.top + deltaTop, left: c.left + deltaLeft } : c));
    }

    const arrowMargin = 12;
    const anchor = anchorRef.current;
    const nextArrowOffset = effectiveSide === 'top' || effectiveSide === 'bottom'
      ? Math.min(Math.max(anchor.left - clampedRectLeft, arrowMargin), Math.max(arrowMargin, rect.width - arrowMargin))
      : Math.min(Math.max(anchor.top - clampedRectTop, arrowMargin), Math.max(arrowMargin, rect.height - arrowMargin));
    setArrowOffset(prev => (prev !== null && Math.abs(prev - nextArrowOffset) < 0.5 ? prev : nextArrowOffset));
  }, [open, coords, effectiveSide]);

  if (!content) return <>{children}</>;

  const show = () => {
    const rect = ref.current?.getBoundingClientRect();
    if (!rect) return;
    flippedRef.current = false;
    setEffectiveSide(side);
    setArrowOffset(null);
    const anchor = anchorFor(side, rect);
    anchorRef.current = anchor;
    setCoords(coordsFor(anchor, side));
    setOpen(true);
  };
  const hide = () => setOpen(false);

  const arrowStyle = effectiveSide === 'top' || effectiveSide === 'bottom'
    ? { left: arrowOffset != null ? `${arrowOffset}px` : '50%', transform: 'translateX(-50%) rotate(45deg)' }
    : { top: arrowOffset != null ? `${arrowOffset}px` : '50%', transform: 'translateY(-50%) rotate(45deg)' };

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
              style={{ position: 'fixed', top: coords.top, left: coords.left, transform: TRANSLATE[effectiveSide] }}
              className="z-[100] pointer-events-none max-w-[260px] px-2.5 py-1.5 rounded-lg bg-gray-900/95 dark:bg-navy-800/95 backdrop-blur-sm text-white text-[11px] font-semibold leading-snug shadow-lg ring-1 ring-black/5 dark:ring-white/10 whitespace-normal break-words"
            >
              {content}
              <span
                aria-hidden
                style={arrowStyle}
                className={`absolute w-2 h-2 bg-gray-900/95 dark:bg-navy-800/95 ${ARROW_EDGE[effectiveSide]}`}
              />
            </motion.span>
          )}
        </AnimatePresence>,
        document.body
      )}
    </span>
  );
}
