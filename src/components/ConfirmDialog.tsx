'use client';

import { createPortal } from 'react-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { TriangleAlert } from 'lucide-react';

export default function ConfirmDialog({
  open, title, message, confirmLabel = 'Confirm', cancelLabel = 'Cancel',
  tone = 'danger', loading = false, onConfirm, onClose,
}: {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'default';
  loading?: boolean;
  onConfirm: () => void;
  onClose: () => void;
}) {
  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <div className="fixed inset-0 z-[200] flex items-center justify-center px-4">
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="absolute inset-0 bg-gray-900/50 dark:bg-black/60 backdrop-blur-[1px]"
            onClick={loading ? undefined : onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: 'easeOut' }}
            role="alertdialog"
            aria-modal="true"
            className="relative w-full max-w-sm bg-white dark:bg-navy-900 rounded-2xl shadow-xl ring-1 ring-black/5 dark:ring-white/10 p-5"
          >
            <div className="flex items-start gap-3">
              <span className={`flex items-center justify-center w-9 h-9 rounded-full shrink-0 ${
                tone === 'danger'
                  ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400'
                  : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400'
              }`}>
                <TriangleAlert size={16} strokeWidth={2.25} />
              </span>
              <div className="min-w-0 pt-0.5">
                <h2 className="text-[13.5px] font-black text-gray-900 dark:text-gray-100">{title}</h2>
                <p className="text-[12px] text-gray-500 dark:text-navy-400 mt-1 leading-relaxed">{message}</p>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 mt-5">
              <button
                type="button"
                onClick={onClose}
                disabled={loading}
                className="text-[12px] font-bold text-gray-600 dark:text-navy-300 bg-gray-50 dark:bg-navy-800 hover:bg-gray-100 dark:hover:bg-navy-700 disabled:opacity-60 px-3.5 py-1.5 rounded-lg transition-colors"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={loading}
                className={`text-[12px] font-bold text-white disabled:opacity-60 px-3.5 py-1.5 rounded-lg transition-colors ${
                  tone === 'danger'
                    ? 'bg-red-600 hover:bg-red-700 active:bg-red-800'
                    : 'bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800'
                }`}
              >
                {loading ? 'Working…' : confirmLabel}
              </button>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
