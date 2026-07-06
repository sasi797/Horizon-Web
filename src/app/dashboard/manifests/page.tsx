'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetHawbManifestsQuery } from '@/services/hawbApi';
import ApiErrorState from '@/components/ApiErrorState';

export default function ManifestsPage() {
  const { data: manifests = [], isLoading, isError, refetch } = useGetHawbManifestsQuery();

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem}>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Manifests</h1>
        <p className="text-[11px] text-gray-400 dark:text-slate-500 mt-0.5">{manifests.length} manifests</p>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-slate-900 rounded-xl border border-gray-100 dark:border-slate-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load manifests" onRetry={refetch} />
      ) : manifests.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-slate-600 text-sm bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800">
          No manifests yet
        </div>
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 shadow-sm overflow-hidden">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-gray-100 dark:border-slate-800">
                {['Reference', 'Jobs', 'Total Weight (kg)', 'Created'].map(h => (
                  <th key={h} className="px-4 py-3 text-[10px] font-bold text-gray-400 dark:text-slate-500 uppercase tracking-wider whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50 dark:divide-slate-800/70">
              {manifests.map(m => (
                <tr key={m.id} className="hover:bg-gray-50/70 dark:hover:bg-slate-800/50 transition-colors">
                  <td className="px-4 py-3 whitespace-nowrap">
                    <Link href={`/dashboard/manifests/${m.id}`} className="font-mono font-bold text-amber-600 dark:text-amber-400 text-[12px] hover:underline">
                      {m.reference_number}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 dark:text-slate-300">{m.job_count}</td>
                  <td className="px-4 py-3 text-[12px] text-gray-700 dark:text-slate-300">{m.total_weight_kg}</td>
                  <td className="px-4 py-3 text-[11px] text-gray-500 dark:text-slate-500 whitespace-nowrap">
                    {new Date(m.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>
      )}
    </motion.div>
  );
}
