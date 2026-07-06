'use client';

import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { usePathname } from 'next/navigation';
import { useAppSelector } from '@/store/hooks';

const PATH_TITLES: { match: (p: string) => boolean; title: string; sub: string }[] = [
  { match: p => /^\/dashboard\/jobs\/.+/.test(p),      title: 'Job Detail',      sub: 'Extracted data & source PDF' },
  { match: p => p.startsWith('/dashboard/jobs'),       title: 'Jobs',            sub: 'HAWB jobs awaiting review'   },
  { match: p => /^\/dashboard\/manifests\/.+/.test(p), title: 'Manifest Detail', sub: 'Locked shipment group'       },
  { match: p => p.startsWith('/dashboard/manifests'),  title: 'Manifests',       sub: 'Grouped, reference-numbered' },
];

export default function Header({ onMenuToggle }: { onMenuToggle?: () => void }) {
  const user     = useAppSelector(state => state.auth.user);
  const pathname = usePathname();
  const page     = PATH_TITLES.find(t => t.match(pathname)) ?? { title: 'Horizon', sub: '' };
  const { title, sub } = page;

  const [clock, setClock] = useState(() => new Date());
  const [tz, setTz]       = useState<'Asia/Kolkata' | 'Europe/London'>('Europe/London');

  useEffect(() => {
    const t = setInterval(() => setClock(new Date()), 1000);
    return () => clearInterval(t);
  }, []);

  const tzLabel = tz === 'Asia/Kolkata'
    ? 'IST'
    : new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London', timeZoneName: 'short' })
        .formatToParts(clock)
        .find(p => p.type === 'timeZoneName')?.value ?? 'UK';
  const timeStr = clock.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true, timeZone: tz });
  const dateStr = clock.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short', timeZone: tz });

  return (
    <motion.header
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.22, 1, 0.36, 1] }}
      className="h-14 bg-gradient-to-r from-amber-50/40 via-white to-white backdrop-blur-md border-b border-gray-200/60 flex items-center gap-2 px-3 md:px-6 sticky top-0 z-10 shadow-sm"
    >
      {/* Hamburger — shown below lg breakpoint */}
      <button
        onClick={onMenuToggle}
        className="lg:hidden p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-700 transition-colors shrink-0"
        aria-label="Open menu"
      >
        <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
        </svg>
      </button>

      <div className="min-w-0">
        <p className="text-[13px] font-black text-gray-900 leading-tight truncate">{title}</p>
        {sub && <p className="text-[10.5px] text-gray-400 leading-tight truncate">{sub}</p>}
      </div>

      <div className="flex-1 min-w-0" />

      {/* Right */}
      <div className="flex items-center gap-2 shrink-0">

        {/* Clock — click to toggle IST / UK */}
        <button
          onClick={() => setTz(z => z === 'Asia/Kolkata' ? 'Europe/London' : 'Asia/Kolkata')}
          title="Click to switch timezone"
          className="hidden lg:flex flex-col items-end leading-none bg-gray-50 border border-gray-100 px-2.5 py-1.5 rounded-lg select-none hover:bg-amber-50 hover:border-amber-200 transition-colors cursor-pointer"
        >
          <div className="flex items-center gap-1">
            <span className="text-[9px] font-bold text-amber-600 uppercase">{tzLabel}</span>
            <span className="text-[12.5px] font-bold text-gray-900 tabular-nums">{timeStr}</span>
          </div>
          <span className="text-[9.5px] text-gray-700 font-medium mt-0.5">{dateStr}</span>
        </button>

        {/* Divider */}
        <div className="w-px h-6 bg-gray-200 mx-0.5" />

        {/* User profile pill */}
        <motion.button
          whileHover={{ backgroundColor: '#fffbeb' }}
          whileTap={{ scale: 0.97 }}
          transition={{ duration: 0.15 }}
          className="flex items-center gap-2.5 pl-2 pr-3 py-1.5 rounded-xl border border-transparent hover:border-amber-100 cursor-default select-none"
        >
          <div className="w-7 h-7 rounded-full bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold shadow-sm shadow-amber-200 shrink-0 ring-2 ring-white">
            {user?.name?.charAt(0)?.toUpperCase() ?? '?'}
          </div>
          <div className="text-left hidden sm:block">
            <p className="text-[12px] font-bold text-gray-900 leading-tight">{user?.name ?? '—'}</p>
            <p className="text-[10px] text-gray-700 capitalize leading-tight">{user?.role ?? ''}</p>
          </div>
        </motion.button>
      </div>
    </motion.header>
  );
}
