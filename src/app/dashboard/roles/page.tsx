'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { ShieldCheck, Plus, CalendarDays, CaseSensitive, KeyRound, Users2, Trash2 } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetRolesQuery, useDeleteRoleMutation } from '@/services/rolesApi';
import ApiErrorState from '@/components/ApiErrorState';
import Tooltip from '@/components/Tooltip';
import RequireRole from '@/components/RequireRole';

const TABLE_COLUMNS = [
  { label: 'Name', icon: CaseSensitive },
  { label: 'Key', icon: KeyRound },
  { label: 'Permissions', icon: ShieldCheck },
  { label: 'Users', icon: Users2 },
  { label: 'Created', icon: CalendarDays },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function RolesPageContent() {
  const { data: roles = [], isLoading, isError, refetch } = useGetRolesQuery();
  const [deleteRole, { isLoading: isDeleting }] = useDeleteRoleMutation();
  const [search, setSearch] = useState('');
  const [error, setError] = useState<string | null>(null);

  const q = search.trim().toLowerCase();
  const filteredRoles = !q ? roles : roles.filter(r =>
    r.name.toLowerCase().includes(q) || r.key.toLowerCase().includes(q)
  );

  const handleDelete = async (id: string, name: string) => {
    if (!window.confirm(`Delete the "${name}" role? This cannot be undone.`)) return;
    setError(null);
    try {
      await deleteRole(id).unwrap();
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to delete role.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-purple-50 dark:bg-purple-950/30 text-purple-600 dark:text-purple-400 flex items-center justify-center mt-0.5">
            <ShieldCheck size={16} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Roles</h1>
            <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
              {filteredRoles.length} role{filteredRoles.length === 1 ? '' : 's'}
              {q && roles.length !== filteredRoles.length ? ` of ${roles.length}` : ''} — define access levels
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, key…"
            aria-label="Search roles"
            className="w-56 h-8 px-2.5 bg-transparent border-0 border-b border-gray-200 dark:border-navy-700 text-[12px] text-gray-700 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          <Link
            href="/dashboard/roles/new"
            className="group inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[12px] font-semibold shadow-sm shadow-emerald-600/20 transition-colors no-underline"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded bg-white/15">
              <Plus size={11} strokeWidth={2.5} />
            </span>
            New Role
          </Link>
        </div>
      </motion.div>

      {error && (
        <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
      )}

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load roles" onRetry={refetch} />
      ) : filteredRoles.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-navy-600 text-sm bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
          {q ? 'No roles match your search' : 'No roles yet'}
        </div>
      ) : (
        <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900">
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-200 dark:border-navy-700">
                  {TABLE_COLUMNS.map(({ label, icon: Icon }, i) => (
                    <th
                      key={label}
                      className={`px-4 pb-2.5 text-[12px] font-medium text-gray-500 dark:text-navy-400 whitespace-nowrap ${i < TABLE_COLUMNS.length - 1 ? 'border-r border-gray-200 dark:border-navy-700' : ''}`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Icon size={13} strokeWidth={1.8} className="text-gray-400 dark:text-navy-500" />
                        {label}
                      </span>
                    </th>
                  ))}
                  <th className="pl-2 pr-4 pb-2.5" />
                </tr>
              </thead>
              <tbody>
                {filteredRoles.map((r) => (
                  <tr
                    key={r.id}
                    className="group border-b border-gray-200 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-gray-50/60 dark:hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-4 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <Link href={`/dashboard/roles/${r.id}`} className="font-semibold text-gray-900 dark:text-gray-100 text-[12.5px] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {r.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className="font-mono text-[10.5px] font-semibold px-1.5 py-0.5 rounded bg-gray-100 dark:bg-navy-800 text-gray-600 dark:text-navy-300">{r.key}</span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 max-w-[240px]">
                      <span className="text-[11.5px] text-gray-500 dark:text-navy-400 truncate block">{r.permissions}</span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] font-medium text-gray-700 dark:text-navy-200">{r.user_count}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[11px] text-gray-500 dark:text-navy-400 whitespace-nowrap">{formatDate(r.created_at)}</td>
                    <td className="pl-2 pr-4 py-2 whitespace-nowrap text-right">
                      <Tooltip content={r.user_count > 0 ? `Cannot delete — ${r.user_count} user${r.user_count === 1 ? '' : 's'} assigned` : undefined}>
                        <button
                          type="button"
                          disabled={r.user_count > 0 || isDeleting}
                          onClick={() => handleDelete(r.id, r.name)}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-red-600 dark:text-red-400 hover:text-red-700 dark:hover:text-red-300 disabled:opacity-30 disabled:hover:text-red-600 dark:disabled:hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={11} /> Delete
                        </button>
                      </Tooltip>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

export default function RolesPage() {
  return (
    <RequireRole role="admin">
      <RolesPageContent />
    </RequireRole>
  );
}
