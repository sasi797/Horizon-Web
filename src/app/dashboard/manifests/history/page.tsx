'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { History, RefreshCw, Check, X, FileText } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import {
  useGetJobUpdatesQuery, useGetHawbManifestsQuery, useApplyJobUpdateMutation, useDismissJobUpdateMutation,
} from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';

const REASON_LABEL: Record<string, string> = {
  duplicate_resend: 'Duplicate Resend',
  blind_companion_merge: 'Blind Companion Merge',
};

const STATUS_BADGE: Record<string, string> = {
  pending: 'bg-amber-50 dark:bg-amber-950/30 text-amber-600 dark:text-amber-400',
  applied: 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400',
  dismissed: 'bg-gray-100 dark:bg-navy-800 text-gray-500 dark:text-navy-400',
};

const STATUS_LABEL: Record<string, string> = {
  pending: 'Pending Review',
  applied: 'Applied',
  dismissed: 'Dismissed',
};

const TABS: { key: 'all' | 'pending' | 'applied' | 'dismissed'; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'pending', label: 'Pending' },
  { key: 'applied', label: 'Applied' },
  { key: 'dismissed', label: 'Dismissed' },
];

function formatDateTime(value: string): string {
  const d = new Date(value);
  const date = d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
  const time = d.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit', hour12: false });
  return `${date} ${time}`;
}

export default function MergeHistoryPage() {
  const router = useRouter();
  const { data: updates = [], isLoading, isError, refetch } = useGetJobUpdatesQuery('all');
  const { data: manifests = [] } = useGetHawbManifestsQuery();
  const [applyJobUpdate, { isLoading: applying, originalArgs: applyingId }] = useApplyJobUpdateMutation();
  const [dismissJobUpdate, { isLoading: dismissing, originalArgs: dismissingId }] = useDismissJobUpdateMutation();
  const [tab, setTab] = useState<'all' | 'pending' | 'applied' | 'dismissed'>('all');

  const manifestRefById = new Map(manifests.map(m => [m.id, m.reference_number]));

  const filtered = tab === 'all' ? updates : updates.filter(u => u.status === tab);
  const sorted = [...filtered].sort((a, b) =>
    new Date(b.resolved_at ?? b.created_at).getTime() - new Date(a.resolved_at ?? a.created_at).getTime()
  );

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-3">
          <button
            onClick={() => router.push('/dashboard/manifests')}
            className="w-7 h-7 flex items-center justify-center rounded-md text-gray-400 dark:text-navy-500 hover:bg-gray-100 dark:hover:bg-navy-800 hover:text-gray-700 dark:hover:text-navy-200 transition-colors mt-0.5 shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <div className="flex items-start gap-2.5">
            <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 flex items-center justify-center mt-0.5">
              <History size={16} strokeWidth={2} />
            </span>
            <div>
              <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Merge History</h1>
              <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
                {sorted.length} record{sorted.length === 1 ? '' : 's'} — duplicate HAWBs and blind/MF-PCS companion merges
              </p>
            </div>
          </div>
        </div>
      </motion.div>

      <motion.div variants={staggerItem} className="flex items-center gap-1">
        {TABS.map(t => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`text-[11px] font-semibold px-3 py-1.5 rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-400'
                : 'text-gray-400 dark:text-navy-500 hover:bg-gray-50 dark:hover:bg-navy-800'
            }`}
          >
            {t.label}
          </button>
        ))}
      </motion.div>

      {isLoading ? (
        <div className="rounded-xl border border-gray-100 dark:border-navy-800 py-16 text-center text-xs text-gray-400 dark:text-navy-500">
          Loading…
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load merge history" onRetry={refetch} />
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full text-left">
              <thead>
                <tr className="border-b border-gray-100 dark:border-navy-800 bg-gray-50/50 dark:bg-navy-800/30">
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">HAWB Number</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Reason</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Status</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Source Document</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Manifest</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Created</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500">Resolved</th>
                  <th className="px-3 py-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-navy-500"></th>
                </tr>
              </thead>
              <tbody>
                {sorted.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-3 py-10 text-center text-xs text-gray-400 dark:text-navy-500">
                      No merge records{tab !== 'all' ? ` with status "${tab}"` : ''} yet.
                    </td>
                  </tr>
                )}
                {sorted.map(u => {
                  const manifestId = u.job.manifest_id;
                  const manifestRef = manifestId ? manifestRefById.get(manifestId) : null;
                  return (
                    <tr key={u.id} className="border-b border-gray-50 dark:border-navy-800/60 last:border-0 hover:bg-gray-50/50 dark:hover:bg-navy-800/20">
                      <td className="px-3 py-2 font-mono text-[11px] font-semibold text-gray-700 dark:text-navy-200 whitespace-nowrap">
                        {u.job.hawb_number}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-600 dark:text-navy-300 whitespace-nowrap">
                        {REASON_LABEL[u.reason] ?? u.reason}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        <span className={`inline-flex items-center text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_BADGE[u.status] ?? ''}`}>
                          {STATUS_LABEL[u.status] ?? u.status}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500 dark:text-navy-400">
                        <Tooltip content={`${u.source_document.sender_email ?? 'unknown sender'} — ${u.source_document.subject ?? 'no subject'}`}>
                          <span className="inline-flex items-center gap-1 max-w-[220px] truncate">
                            <FileText size={11} className="shrink-0 text-gray-300 dark:text-navy-600" />
                            {u.source_document.filename}
                          </span>
                        </Tooltip>
                      </td>
                      <td className="px-3 py-2 text-[11px] whitespace-nowrap">
                        {manifestId ? (
                          <button
                            onClick={() => router.push(`/dashboard/manifests/${manifestId}`)}
                            className="font-mono text-emerald-600 dark:text-emerald-400 hover:underline"
                          >
                            {manifestRef ?? manifestId.slice(0, 8)}
                          </button>
                        ) : (
                          <span className="text-gray-300 dark:text-navy-600">—</span>
                        )}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500 dark:text-navy-400 whitespace-nowrap">
                        {formatDateTime(u.created_at)}
                      </td>
                      <td className="px-3 py-2 text-[11px] text-gray-500 dark:text-navy-400 whitespace-nowrap">
                        {u.resolved_at ? formatDateTime(u.resolved_at) : <span className="text-gray-300 dark:text-navy-600">—</span>}
                      </td>
                      <td className="px-3 py-2 whitespace-nowrap">
                        {u.status === 'pending' && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => applyJobUpdate(u.id)}
                              disabled={applying || dismissing}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/40 disabled:opacity-40 transition-colors"
                              title="Apply this update"
                            >
                              {applying && applyingId === u.id ? <RefreshCw size={12} className="animate-spin" /> : <Check size={13} />}
                            </button>
                            <button
                              onClick={() => dismissJobUpdate(u.id)}
                              disabled={applying || dismissing}
                              className="w-6 h-6 flex items-center justify-center rounded-md text-red-500 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/40 disabled:opacity-40 transition-colors"
                              title="Dismiss this update"
                            >
                              {dismissing && dismissingId === u.id ? <RefreshCw size={12} className="animate-spin" /> : <X size={13} />}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}
