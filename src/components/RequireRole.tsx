'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';

const Spinner = () => (
  <div className="min-h-[50vh] flex items-center justify-center">
    <div className="w-6 h-6 rounded-full border-2 border-emerald-500 border-t-transparent animate-spin" />
  </div>
);

export default function RequireRole({ role, children }: { role: string; children: React.ReactNode }) {
  const router = useRouter();
  const user = useAppSelector(state => state.auth.user);

  // Prevent hydration mismatch: auth state is always null on the server,
  // so wait for client mount before deciding to redirect (same pattern as DashboardGuard).
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!user || user.role !== role) {
      router.replace('/dashboard');
    }
  }, [mounted, user, role, router]);

  if (!mounted || !user || user.role !== role) return <Spinner />;

  return <>{children}</>;
}
