'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import { ArrowLeft, UserCog, RefreshCw } from 'lucide-react';
import { pageTransition, staggerItem } from '@/lib/animations';
import { useGetUsersQuery, useUpdateUserMutation, useDeactivateUserMutation } from '@/services/usersApi';
import { useGetRolesQuery } from '@/services/rolesApi';
import { useAppSelector } from '@/store/hooks';
import ApiErrorState from '@/components/ApiErrorState';
import RequireRole from '@/components/RequireRole';

function Field({ label, children }: { label: React.ReactNode; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-[10px] font-bold text-gray-400 dark:text-navy-500 uppercase tracking-wide mb-1.5">{label}</label>
      {children}
    </div>
  );
}

const inputClass = 'w-full h-9 px-3 bg-transparent border border-gray-200 dark:border-navy-700 rounded-lg text-[13px] text-gray-800 dark:text-navy-100 placeholder:text-gray-400 dark:placeholder:text-navy-500 focus:outline-none focus:border-emerald-500/60 transition-colors';

function EditUserPageContent() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const currentUser = useAppSelector(state => state.auth.user);
  const { data: users = [], isLoading, isError, refetch } = useGetUsersQuery();
  const { data: roles = [] } = useGetRolesQuery();
  const [updateUser, { isLoading: isSaving }] = useUpdateUserMutation();
  const [deactivateUser, { isLoading: isDeactivating }] = useDeactivateUserMutation();

  const user = users.find(u => u.id === id);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [roleId, setRoleId] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [syncedFor, setSyncedFor] = useState<string | null>(null);

  useEffect(() => {
    if (user && syncedFor !== user.id) {
      setSyncedFor(user.id);
      setName(user.name);
      setEmail(user.email);
      setRoleId(user.role_id);
      setPassword('');
    }
  }, [user, syncedFor]);

  if (isLoading) {
    return <div className="h-64 bg-white dark:bg-navy-900 rounded-2xl border border-gray-100 dark:border-navy-800 animate-pulse" />;
  }
  if (isError) {
    return <ApiErrorState title="Failed to load user" onRetry={refetch} />;
  }
  if (!user) {
    return <ApiErrorState title="User Not Found" message="This user does not exist." status={404} />;
  }

  const isSelf = currentUser?.id === user.id;
  const canSubmit = name.trim() && email.trim() && roleId && (!password || password.length >= 8);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    try {
      await updateUser({
        id: user.id,
        body: {
          name: name.trim(),
          email: email.trim(),
          role_id: roleId,
          ...(password ? { password } : {}),
        },
      }).unwrap();
      router.push('/dashboard/users');
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to save user. Please try again.');
    }
  };

  const handleToggleActive = async () => {
    setError(null);
    try {
      if (user.is_active) {
        await deactivateUser(user.id).unwrap();
      } else {
        await updateUser({ id: user.id, body: { is_active: true } }).unwrap();
      }
    } catch (err) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setError(detail ?? 'Failed to update status.');
    }
  };

  return (
    <motion.div variants={pageTransition} initial="hidden" animate="visible" className="space-y-4 max-w-lg">
      <motion.div variants={staggerItem} className="flex items-center gap-2.5">
        <Link href="/dashboard/users" className="text-gray-400 dark:text-navy-500 hover:text-gray-600 dark:hover:text-navy-300 transition-colors">
          <ArrowLeft size={16} />
        </Link>
        <span className="flex-shrink-0 w-8 h-8 rounded-lg bg-blue-50 dark:bg-blue-950/30 text-blue-600 dark:text-blue-400 flex items-center justify-center">
          <UserCog size={16} strokeWidth={2} />
        </span>
        <h1 className="text-base font-black text-gray-900 dark:text-gray-100 leading-tight">Edit User</h1>
      </motion.div>

      <motion.form variants={staggerItem} onSubmit={handleSubmit} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl p-5 space-y-4">
        <Field label="Name">
          <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Email">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className={inputClass} required />
        </Field>
        <Field label="Password">
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} className={inputClass} placeholder="Leave blank to keep current password" minLength={8} />
          <p className="text-[10.5px] text-gray-400 dark:text-navy-500 mt-1">Leave blank to keep current password — otherwise minimum 8 characters</p>
        </Field>
        <Field label="Role">
          <select value={roleId} onChange={(e) => setRoleId(e.target.value)} className={inputClass} required>
            {roles.map((r) => (
              <option key={r.id} value={r.id}>{r.name}</option>
            ))}
          </select>
        </Field>

        {error && (
          <p className="text-[12px] text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/30 rounded-lg px-3 py-2">{error}</p>
        )}

        <div className="flex items-center gap-3 pt-2">
          <button
            type="submit"
            disabled={!canSubmit || isSaving}
            className="h-9 px-4 rounded-lg bg-emerald-600 hover:bg-emerald-700 disabled:opacity-50 text-white text-[12.5px] font-semibold transition-colors"
          >
            {isSaving ? 'Saving…' : 'Save Changes'}
          </button>
          <Link href="/dashboard/users" className="text-[12.5px] text-gray-500 dark:text-navy-400 hover:text-gray-700 dark:hover:text-navy-200 transition-colors">
            Cancel
          </Link>
        </div>
      </motion.form>

      <motion.div variants={staggerItem} className="bg-white dark:bg-navy-900 border border-gray-100 dark:border-navy-800 rounded-2xl p-5 flex items-center justify-between">
        <div>
          <p className="text-[12.5px] font-semibold text-gray-800 dark:text-gray-100">Account Status</p>
          <p className="text-[11px] text-gray-400 dark:text-navy-500 mt-0.5">
            {user.is_active ? 'This account is active and can log in.' : 'This account is deactivated and cannot log in.'}
          </p>
        </div>
        {isSelf ? (
          <span className="text-[11px] text-gray-400 dark:text-navy-500">You cannot deactivate your own account</span>
        ) : (
          <button
            type="button"
            disabled={isDeactivating || isSaving}
            onClick={handleToggleActive}
            className={`inline-flex items-center gap-1.5 h-8 px-3 rounded-lg text-[12px] font-semibold transition-colors disabled:opacity-50 ${
              user.is_active
                ? 'bg-red-50 dark:bg-red-950/30 text-red-600 dark:text-red-400 hover:bg-red-100 dark:hover:bg-red-950/50'
                : 'bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 hover:bg-emerald-100 dark:hover:bg-emerald-950/50'
            }`}
          >
            <RefreshCw size={12} />
            {user.is_active ? 'Deactivate' : 'Reactivate'}
          </button>
        )}
      </motion.div>
    </motion.div>
  );
}

export default function EditUserPage() {
  return (
    <RequireRole role="admin">
      <EditUserPageContent />
    </RequireRole>
  );
}
