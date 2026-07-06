'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';

const Spinner = () => (
  <div className="min-h-screen flex items-center justify-center bg-gray-50 dark:bg-slate-950">
    <div className="w-6 h-6 rounded-full border-2 border-amber-500 border-t-transparent animate-spin" />
  </div>
);

export default function DashboardGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { accessToken } = useAppSelector(state => state.auth);

  // Prevent hydration mismatch: localStorage is unavailable on the server,
  // so auth state is always null there. Wait for client mount before deciding.
  const [mounted, setMounted] = useState(false);
  useEffect(() => { setMounted(true); }, []);

  useEffect(() => {
    if (!mounted) return;
    if (!accessToken) {
      router.replace('/login');
    }
  }, [mounted, accessToken, router]);

  // Server render + pre-hydration: show neutral spinner (matches server HTML)
  if (!mounted) return <Spinner />;

  if (!accessToken) return <Spinner />;

  return <>{children}</>;
}
