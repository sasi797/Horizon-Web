'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  FileText,
  PackageCheck,
  LogOut,
  PanelLeftClose,
  PanelLeftOpen,
} from 'lucide-react';
import { staggerContainer, staggerItem, slideLeft } from '@/lib/animations';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/services/authApi';

const navItems = [
  { label: 'Jobs',      href: '/dashboard/jobs',      icon: FileText },
  { label: 'Manifests', href: '/dashboard/manifests', icon: PackageCheck },
];

const SunriseLogo = ({ size = 20 }: { size?: number }) => (
  <svg width={size} height={size} fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <circle cx="12" cy="12" r="6.5" strokeWidth="2" />
    <line x1="4" y1="12" x2="20" y2="12" strokeWidth="2" strokeLinecap="round" />
  </svg>
);

export default function Sidebar({
  onClose,
  collapsed,
  onToggleCollapse,
}: {
  onClose?: () => void;
  collapsed?: boolean;
  onToggleCollapse?: () => void;
}) {
  const pathname  = usePathname();
  const router    = useRouter();
  const dispatch  = useAppDispatch();
  const user      = useAppSelector(state => state.auth.user);
  const [logoutApi] = useLogoutMutation();

  const handleLogout = async () => {
    try { await logoutApi().unwrap(); } catch { /* ignore */ }
    dispatch(logout());
    router.push('/login');
  };

  const isActive = (href: string) => pathname.startsWith(href);

  return (
    <motion.aside
      variants={slideLeft}
      initial="hidden"
      animate="visible"
      className={`${collapsed ? 'w-16' : 'w-56'} h-full min-h-screen bg-slate-900 flex flex-col shadow-[2px_0_12px_0_rgba(0,0,0,0.25)] transition-[width] duration-300 overflow-hidden`}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className={`h-14 flex items-center justify-between border-b border-white/5 z-10 relative ${collapsed ? 'px-[6px]' : 'px-4'} transition-[padding] duration-300`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          <motion.div
            whileHover={{ rotate: 10, scale: 1.1 }}
            transition={{ type: 'spring', stiffness: 400 }}
            className={`${collapsed ? 'w-7 h-7' : 'w-9 h-9'} flex-shrink-0 bg-gradient-to-br from-amber-500 to-orange-600 rounded-xl flex items-center justify-center shadow-lg shadow-amber-900/40 transition-all duration-300`}
          >
            <SunriseLogo size={collapsed ? 14 : 20} />
          </motion.div>

          <AnimatePresence>
            {!collapsed && (
              <motion.p
                key="horizon-label"
                initial={{ opacity: 0, x: -6 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -6 }}
                transition={{ duration: 0.15 }}
                className="font-bold text-white text-sm leading-tight tracking-tight whitespace-nowrap"
              >
                Horizon
              </motion.p>
            )}
          </AnimatePresence>
        </div>

        {/* Collapse toggle */}
        {onToggleCollapse && (
          <motion.button
            onClick={onToggleCollapse}
            whileHover={{ scale: 1.15 }}
            whileTap={{ scale: 0.88 }}
            className="flex-shrink-0 w-6 h-6 flex items-center justify-center rounded-md text-slate-400 hover:text-amber-400 hover:bg-white/5 transition-colors"
            title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          >
            {collapsed
              ? <PanelLeftOpen size={15} strokeWidth={1.8} />
              : <PanelLeftClose size={15} strokeWidth={1.8} />
            }
          </motion.button>
        )}
      </motion.div>

      {/* Nav */}
      <motion.nav
        variants={staggerContainer}
        initial="hidden"
        animate="visible"
        className={`flex-1 pt-4 pb-1 ${collapsed ? 'px-1.5' : 'px-3'} space-y-0.5 transition-[padding] duration-300`}
      >
        {navItems.map((item) => {
          const active = isActive(item.href);
          const Icon = item.icon;
          return (
            <motion.div key={item.href} variants={staggerItem}>
              <Link
                href={item.href}
                onClick={onClose}
                className="no-underline"
                title={collapsed ? item.label : undefined}
              >
                <motion.div
                  whileHover={{ x: collapsed ? 0 : 3 }}
                  whileTap={{ scale: 0.97 }}
                  transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                  className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                    active
                      ? 'bg-amber-400/10 text-amber-400'
                      : 'text-slate-300 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  {active && (
                    <motion.div
                      layoutId="sidebar-active"
                      className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-amber-400 to-orange-500 rounded-r-full"
                      transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                    />
                  )}

                  <span className={`relative flex-shrink-0 ${active ? 'text-amber-400' : 'text-slate-400'}`}>
                    <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                  </span>

                  {!collapsed && item.label}
                </motion.div>
              </Link>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* User + Logout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className={`${collapsed ? 'px-1.5' : 'px-3'} pb-5 pt-4 space-y-1 border-t border-white/5 relative z-10 transition-[padding] duration-300`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2 mb-1`}>
          <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? '—'}</p>
              <p className="text-[10px] text-slate-400 truncate capitalize">{user?.role ?? ''}</p>
            </div>
          )}
        </div>

        <motion.button
          onClick={() => { handleLogout(); onClose?.(); }}
          whileHover={{ x: collapsed ? 0 : 3 }}
          whileTap={{ scale: 0.97 }}
          title={collapsed ? 'Logout' : undefined}
          className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-xl text-sm font-medium text-slate-300 hover:bg-red-500/10 hover:text-red-400 transition-colors cursor-pointer`}
        >
          <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
          {!collapsed && 'Logout'}
        </motion.button>
      </motion.div>
    </motion.aside>
  );
}
