'use client';

import { useState } from 'react';
import Link from 'next/link';
import { motion } from 'framer-motion';
import { Users as UsersIcon, Plus, CalendarDays, CircleDot, Mail, ShieldCheck, CaseSensitive, RefreshCw } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetUsersQuery, useUpdateUserMutation } from '@/services/usersApi';
import ApiErrorState from '@/components/ApiErrorState';
import RequireRole from '@/components/RequireRole';

const TABLE_COLUMNS = [
  { label: 'Name', icon: CaseSensitive },
  { label: 'Email', icon: Mail },
  { label: 'Role', icon: ShieldCheck },
  { label: 'Status', icon: CircleDot },
  { label: 'Created', icon: CalendarDays },
];

function formatDate(value: string): string {
  return new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function UsersPageContent() {
  const { data: users = [], isLoading, isError, refetch } = useGetUsersQuery();
  const [updateUser, { isLoading: isReactivating }] = useUpdateUserMutation();
  const [search, setSearch] = useState('');

  const q = search.trim().toLowerCase();
  const filteredUsers = !q ? users : users.filter(u =>
    u.name.toLowerCase().includes(q) ||
    u.email.toLowerCase().includes(q) ||
    u.role.name.toLowerCase().includes(q)
  );

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4">
      <motion.div variants={staggerItem} className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center mt-0.5">
            <UsersIcon size={16} strokeWidth={2} />
          </span>
          <div>
            <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Users</h1>
            <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
              {filteredUsers.length} user{filteredUsers.length === 1 ? '' : 's'}
              {q && users.length !== filteredUsers.length ? ` of ${users.length}` : ''} — manage accounts and access
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search name, email, role…"
            aria-label="Search users"
            className="w-56 h-8 px-2.5 bg-transparent border-0 border-b border-gray-200 dark:border-navy-700 text-[12px] text-gray-700 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors"
          />
          <Link
            href="/dashboard/users/new"
            className="group inline-flex items-center gap-2 h-8 pl-2 pr-3 rounded-lg bg-emerald-600 hover:bg-emerald-700 active:bg-emerald-800 text-white text-[12px] font-semibold shadow-sm shadow-emerald-600/20 transition-colors no-underline"
          >
            <span className="flex items-center justify-center w-4 h-4 rounded bg-white/15">
              <Plus size={11} strokeWidth={2.5} />
            </span>
            New User
          </Link>
        </div>
      </motion.div>

      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-12 bg-white dark:bg-navy-900 rounded-xl border border-gray-100 dark:border-navy-800 animate-pulse" />
          ))}
        </div>
      ) : isError ? (
        <ApiErrorState title="Failed to load users" onRetry={refetch} />
      ) : filteredUsers.length === 0 ? (
        <div className="flex items-center justify-center h-48 text-gray-300 dark:text-navy-600 text-sm bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800">
          {q ? 'No users match your search' : 'No users yet'}
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
                {filteredUsers.map((u) => (
                  <tr
                    key={u.id}
                    className="group border-b border-gray-200 dark:border-navy-700 hover:border-emerald-300 dark:hover:border-emerald-700/50 hover:bg-gray-50/60 dark:hover:bg-navy-800/30 transition-colors"
                  >
                    <td className="px-4 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <Link href={`/dashboard/users/${u.id}`} className="font-semibold text-gray-900 dark:text-gray-100 text-[12.5px] hover:text-emerald-600 dark:hover:text-emerald-400 transition-colors">
                        {u.name}
                      </Link>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[12px] text-gray-600 dark:text-navy-300 whitespace-nowrap">{u.email}</td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className="inline-flex items-center text-[11px] font-medium px-2.5 py-1 rounded-full bg-purple-100 dark:bg-purple-900/40 text-purple-700 dark:text-purple-300">
                        {u.role.name}
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 whitespace-nowrap">
                      <span className={`inline-flex items-center gap-1.5 text-[11px] font-medium px-2.5 py-1 rounded-full ${
                        u.is_active
                          ? 'bg-emerald-100 dark:bg-emerald-900/40 text-emerald-700 dark:text-emerald-300'
                          : 'bg-red-100 dark:bg-red-900/40 text-red-700 dark:text-red-300'
                      }`}>
                        <span className="w-1.5 h-1.5 rounded-full bg-current opacity-70" />
                        {u.is_active ? 'Active' : 'Inactive'}
                      </span>
                    </td>
                    <td className="px-2 py-2 border-r border-gray-200 dark:border-navy-700 text-[11px] text-gray-500 dark:text-navy-400 whitespace-nowrap">{formatDate(u.created_at)}</td>
                    <td className="pl-2 pr-4 py-2 whitespace-nowrap text-right">
                      {!u.is_active && (
                        <button
                          type="button"
                          disabled={isReactivating}
                          onClick={() => updateUser({ id: u.id, body: { is_active: true } })}
                          className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 dark:hover:text-emerald-300 disabled:opacity-50 transition-colors"
                        >
                          <RefreshCw size={11} /> Reactivate
                        </button>
                      )}
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

export default function UsersPage() {
  return (
    <RequireRole role="admin">
      <UsersPageContent />
    </RequireRole>
  );
}
