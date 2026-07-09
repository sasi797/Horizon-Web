'use client';

import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion } from 'framer-motion';
import {
  PackageCheck,
  LogOut,
} from 'lucide-react';
import Logo from './Logo';
import Tooltip from './Tooltip';
import { staggerContainer, staggerItem, slideLeft } from '@/lib/animations';
import { useAppSelector, useAppDispatch } from '@/store/hooks';
import { logout } from '@/store/slices/authSlice';
import { useLogoutMutation } from '@/services/authApi';

const navItems = [
  { label: 'Manifests', href: '/dashboard/manifests', icon: PackageCheck },
];

export default function Sidebar({
  onClose,
  collapsed,
}: {
  onClose?: () => void;
  collapsed?: boolean;
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
      className={`${collapsed ? 'w-16' : 'w-56'} h-full min-h-screen bg-white dark:bg-navy-900 border-r border-gray-200 dark:border-transparent flex flex-col shadow-[2px_0_12px_0_rgba(0,0,0,0.04)] dark:shadow-[2px_0_12px_0_rgba(0,0,0,0.25)] transition-[width] duration-300 overflow-hidden`}
    >
      {/* Logo */}
      <motion.div
        initial={{ opacity: 0, y: -12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.1, duration: 0.4 }}
        className={`h-20 flex items-center border-b border-gray-100 dark:border-white/5 z-10 relative ${collapsed ? 'px-[6px] justify-center' : 'px-4'} transition-[padding] duration-300`}
      >
        <div className="flex items-center gap-2.5 min-w-0">
          {collapsed ? (
            <motion.div
              whileHover={{ rotate: 10, scale: 1.1 }}
              transition={{ type: 'spring', stiffness: 400 }}
              className="flex-shrink-0 flex items-center justify-center transition-all duration-300"
            >
              <Logo size={34} />
            </motion.div>
          ) : (
            <motion.div
              key="horizon-lockup"
              initial={{ opacity: 0, x: -6 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ duration: 0.15 }}
              className="flex-shrink-0 rounded-lg dark:bg-white dark:px-2 dark:py-1 transition-colors"
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/HorizonLogo.png" alt="Horizon Express" className="h-14 w-auto block" />
            </motion.div>
          )}
        </div>
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
              <Tooltip content={collapsed ? item.label : undefined} side="right">
                <Link
                  href={item.href}
                  onClick={onClose}
                  className="no-underline"
                >
                  <motion.div
                    whileHover={{ x: collapsed ? 0 : 3 }}
                    whileTap={{ scale: 0.97 }}
                    transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                    className={`relative flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2.5 rounded-xl text-sm font-medium transition-colors cursor-pointer ${
                      active
                        ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-400/10 dark:text-emerald-400'
                        : 'text-gray-500 hover:bg-gray-100 hover:text-gray-900 dark:text-navy-300 dark:hover:bg-white/5 dark:hover:text-white'
                    }`}
                  >
                    {active && (
                      <motion.div
                        layoutId="sidebar-active"
                        className="absolute left-0 top-1/2 -translate-y-1/2 w-1 h-5 bg-gradient-to-b from-emerald-400 to-emerald-600 rounded-r-full"
                        transition={{ type: 'spring', stiffness: 380, damping: 28 }}
                      />
                    )}

                    <span className={`relative flex-shrink-0 ${active ? 'text-emerald-600 dark:text-emerald-400' : 'text-gray-400 dark:text-navy-400'}`}>
                      <Icon size={17} strokeWidth={active ? 2.2 : 1.8} />
                    </span>

                    {!collapsed && item.label}
                  </motion.div>
                </Link>
              </Tooltip>
            </motion.div>
          );
        })}
      </motion.nav>

      {/* User + Logout */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.4 }}
        className={`${collapsed ? 'px-1.5' : 'px-3'} pb-5 pt-4 space-y-1 border-t border-gray-100 dark:border-white/5 relative z-10 transition-[padding] duration-300`}
      >
        <div className={`flex items-center ${collapsed ? 'justify-center' : 'gap-2.5'} px-3 py-2 mb-1`}>
          <div className="w-7 h-7 flex-shrink-0 rounded-full bg-gradient-to-br from-emerald-500 to-emerald-700 flex items-center justify-center text-white text-xs font-bold shadow">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          {!collapsed && (
            <div className="min-w-0">
              <p className="text-xs font-semibold text-gray-900 dark:text-white truncate">{user?.name ?? '—'}</p>
              <p className="text-[10px] text-gray-400 dark:text-navy-400 truncate capitalize">{user?.role ?? ''}</p>
            </div>
          )}
        </div>

        <Tooltip content={collapsed ? 'Logout' : undefined} side="right" className="flex w-full">
          <motion.button
            onClick={() => { handleLogout(); onClose?.(); }}
            whileHover={{ x: collapsed ? 0 : 3 }}
            whileTap={{ scale: 0.97 }}
            className={`w-full flex items-center ${collapsed ? 'justify-center' : 'gap-3'} px-3 py-2 rounded-xl text-sm font-medium text-gray-500 hover:bg-red-50 hover:text-red-600 dark:text-navy-300 dark:hover:bg-red-500/10 dark:hover:text-red-400 transition-colors cursor-pointer`}
          >
            <LogOut size={17} strokeWidth={1.8} className="flex-shrink-0" />
            {!collapsed && 'Logout'}
          </motion.button>
        </Tooltip>
      </motion.div>
    </motion.aside>
  );
}
