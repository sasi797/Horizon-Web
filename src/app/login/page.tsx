'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Mail, Lock, Eye, EyeOff, KeyRound, ArrowLeft, ArrowRight,
  Package, Truck, MapPin, PlaneTakeoff, AlertCircle, CheckCircle2,
} from 'lucide-react';
import Logo from '@/components/Logo';
import { useLoginMutation, useResetPasswordMutation } from '@/services/authApi';
import { useAppDispatch } from '@/store/hooks';
import { setCredentials } from '@/store/slices/authSlice';

type View = 'login' | 'reset';

export default function LoginPage() {
  const router   = useRouter();
  const dispatch = useAppDispatch();

  const [view,          setView]          = useState<View>('login');
  const [email,         setEmail]         = useState('');
  const [password,      setPassword]      = useState('');
  const [showPassword,  setShowPassword]  = useState(false);
  const [newPass,       setNewPass]       = useState('');
  const [showNewPass,   setShowNewPass]   = useState(false);
  const [confirmPass,   setConfirmPass]   = useState('');
  const [showConfirm,   setShowConfirm]   = useState(false);
  const [errorMsg,      setErrorMsg]      = useState('');
  const [successMsg,    setSuccessMsg]    = useState('');

  const [login,         { isLoading: loggingIn }]  = useLoginMutation();
  const [resetPassword, { isLoading: resetting }]  = useResetPasswordMutation();


  const handleLogin = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMsg('');
    try {
      const tokens = await login({ email: email.toLowerCase(), password }).unwrap();
      const res  = await fetch(`${process.env.NEXT_PUBLIC_API_URL}/auth/me`, {
        headers: { Authorization: `Bearer ${tokens.access_token}` },
      });
      const user = await res.json();
      dispatch(setCredentials({ accessToken: tokens.access_token, refreshToken: tokens.refresh_token, user }));
      router.push('/dashboard/jobs');
    } catch {
      setErrorMsg('Invalid email or password');
    }
  };

  const handleReset = async (e: React.SyntheticEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (newPass !== confirmPass) { setErrorMsg('Passwords do not match'); return; }
    if (newPass.length < 6)      { setErrorMsg('Password must be at least 6 characters'); return; }
    try {
      await resetPassword({ email: email.toLowerCase(), new_password: newPass, confirm_password: confirmPass }).unwrap();
      setSuccessMsg('Password reset successfully! You can now sign in.');
      setNewPass(''); setConfirmPass('');
      setTimeout(() => { setView('login'); setSuccessMsg(''); }, 2000);
    } catch (err: unknown) {
      const detail = (err as { data?: { detail?: string } })?.data?.detail;
      setErrorMsg(detail ?? 'Reset failed. Check your email and try again.');
    }
  };

  const switchView = (v: View) => {
    setErrorMsg(''); setSuccessMsg('');
    setNewPass(''); setConfirmPass('');
    setView(v);
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden bg-gray-100">
      {/* Dot grid */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <pattern id="bg-dots" x="0" y="0" width="28" height="28" patternUnits="userSpaceOnUse">
            <circle cx="1.5" cy="1.5" r="1.5" fill="#94a3b8" fillOpacity="0.35" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#bg-dots)" />
      </svg>

      {/* Floating card */}
      <motion.div
        initial={{ opacity: 0, scale: 0.96, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
        className="w-full max-w-[860px] min-h-[500px] rounded-2xl overflow-hidden shadow-xl shadow-gray-300/50 border border-gray-200 flex relative z-10 bg-white"
      >

        {/* ── LEFT: navy hero panel ── */}
        <div
          className="hidden md:flex w-[52%] shrink-0 relative overflow-hidden flex-col justify-center px-12 py-10"
          style={{ background: 'linear-gradient(145deg, #0f1f3a 0%, #0a1628 55%, #065f46 130%)' }}
        >
          {/* Green glow */}
          <div className="absolute -bottom-24 left-1/2 -translate-x-1/2 w-[36rem] h-[18rem] rounded-full bg-gradient-to-t from-emerald-500/40 via-emerald-400/15 to-transparent blur-2xl pointer-events-none" />

          {/* Topographic contour lines */}
          <svg className="absolute inset-0 w-full h-full" fill="none" preserveAspectRatio="xMidYMid slice">
            {[
              'M-60 120 C 40 60,  160 180, 280 110 S 440  40, 560  90',
              'M-60 170 C 50 110, 170 230, 290 155 S 450  85, 570 135',
              'M-60 220 C 60 155, 180 280, 300 200 S 460 130, 580 178',
              'M-60 270 C 50 200, 175 325, 305 248 S 465 175, 585 222',
              'M-60  70 C 30  10, 145 130, 265  60 S 430 -10, 555  40',
              'M-60 320 C 55 250, 180 372, 310 295 S 468 220, 588 268',
              'M-60 370 C 45 298, 170 418, 300 342 S 462 265, 582 315',
              'M-60  20 C 20 -40, 130  80, 250  10 S 415 -60, 540 -10',
            ].map((d, i) => (
              <path key={i} d={d} stroke="white" strokeWidth="1.2" opacity={0.14 - i * 0.008} />
            ))}
          </svg>

          {/* Plus signs */}
          {[
            { top: '10%', left: '6%'  },
            { top: '18%', left: '68%' },
            { top: '62%', left: '8%'  },
            { top: '78%', left: '62%' },
            { top: '88%', left: '32%' },
          ].map((s, i) => (
            <span key={i} className="absolute text-white/30 text-xl font-light pointer-events-none select-none" style={s}>+</span>
          ))}

          {/* Small hollow circles */}
          {[
            { top: '28%', left: '14%', size: 10 },
            { top: '55%', left: '55%', size: 8  },
            { top: '72%', left: '22%', size: 12 },
            { top: '15%', left: '48%', size: 9  },
          ].map((c, i) => (
            <div key={i} className="absolute rounded-full border border-white/25 pointer-events-none"
              style={{ top: c.top, left: c.left, width: c.size, height: c.size }} />
          ))}

          {/* Corner rings */}
          <div className="absolute -top-12 -right-12 w-40 h-40 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -top-6  -right-6  w-24 h-24 rounded-full border border-white/15 pointer-events-none" />
          <div className="absolute -bottom-14 -left-14 w-44 h-44 rounded-full border border-white/20 pointer-events-none" />
          <div className="absolute -bottom-7  -left-7  w-28 h-28 rounded-full border border-white/15 pointer-events-none" />

          {/* Logo */}
          <motion.div
            initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}
            className="absolute top-8 left-12 bg-white rounded-lg px-4 py-3 shadow-lg inline-flex items-center justify-center"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src="/HorizonLogo.png" alt="Horizon Express" className="h-10 w-auto block" />
          </motion.div>

          {/* Scattered logistics icon tiles */}
          {[
            { Icon: Package,      top: '20%', left: '62%', rotate: -8,  delay: 0.5 },
            { Icon: Truck,        top: '58%', left: '8%',  rotate: 6,   delay: 0.6 },
            { Icon: PlaneTakeoff, top: '14%', left: '10%', rotate: 5,   delay: 0.7 },
            { Icon: MapPin,       top: '68%', left: '66%', rotate: -5,  delay: 0.8 },
          ].map(({ Icon, top, left, rotate, delay }, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate }}
              transition={{ delay, duration: 0.4 }}
              className="absolute w-11 h-11 rounded-xl bg-white/10 border border-white/20 backdrop-blur-sm shadow-md shadow-black/20 flex items-center justify-center text-emerald-300"
              style={{ top, left }}
            >
              <Icon size={18} />
            </motion.div>
          ))}

          {/* Welcome copy */}
          <div className="relative z-10">
            <motion.h1
              initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}
              className="text-4xl font-black text-white leading-tight mb-3"
            >
              Welcome back!
            </motion.h1>
            <motion.p
              initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.4 }}
              className="text-white/65 text-[15px] leading-relaxed max-w-[240px]"
            >
              You can sign in to access your existing account.
            </motion.p>
          </div>
        </div>

        {/* ── RIGHT: white form panel ── */}
        <div className="flex-1 bg-white flex flex-col overflow-hidden">
          {/* Accent bar */}
          <div className="h-1.5 w-full bg-gradient-to-r from-emerald-500 via-emerald-600 to-emerald-700 shrink-0" />

          <div className="flex-1 flex items-center justify-center px-10 py-8">
            <div className="w-full max-w-[310px]">

              <AnimatePresence mode="wait">

                {/* ── LOGIN VIEW ── */}
                {view === 'login' && (
                  <motion.div key="login"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-7">
                      <Logo size={40} className="mb-4" />
                      <h2 className="text-2xl font-black text-gray-800">Sign In</h2>
                      <p className="text-[13px] text-gray-400 mt-1">Welcome back — enter your details below</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleLogin}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Mail size={16} strokeWidth={1.8} />
                          </span>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com" required
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Lock size={16} strokeWidth={1.8} />
                          </span>
                          <input type={showPassword ? 'text' : 'password'} value={password} onChange={e => setPassword(e.target.value)}
                            placeholder="••••••••" required
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                          <button type="button" onClick={() => setShowPassword(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors">
                            {showPassword ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                          </button>
                        </div>
                      </div>

                      <div className="flex items-center justify-end">
                        <button type="button" onClick={() => switchView('reset')}
                          className="text-[12px] text-emerald-600 hover:text-emerald-700 font-semibold transition-colors">
                          Forgot password?
                        </button>
                      </div>

                      {errorMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          <AlertCircle size={14} className="shrink-0" /> {errorMsg}
                        </motion.p>
                      )}

                      <motion.button type="submit" disabled={loggingIn}
                        whileHover={{ scale: 1.015, boxShadow: '0 8px 28px rgba(5,150,105,0.4)' }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-full py-3 mt-1 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-sm font-bold
                                   rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 cursor-pointer
                                   flex items-center justify-center gap-1.5">
                        {loggingIn ? 'Signing in…' : <>Sign In <ArrowRight size={15} /></>}
                      </motion.button>
                    </form>
                  </motion.div>
                )}

                {/* ── RESET PASSWORD VIEW ── */}
                {view === 'reset' && (
                  <motion.div key="reset"
                    initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -20 }}
                    transition={{ duration: 0.25 }}
                  >
                    <div className="mb-7">
                      <div className="w-12 h-12 bg-emerald-600 rounded-xl flex items-center justify-center shadow-lg shadow-emerald-200 mb-4 text-white">
                        <KeyRound size={20} strokeWidth={2} />
                      </div>
                      <h2 className="text-2xl font-black text-gray-800">Reset Password</h2>
                      <p className="text-[13px] text-gray-400 mt-1">Enter your email and choose a new password</p>
                    </div>

                    <form className="space-y-4" onSubmit={handleReset}>
                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Email</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Mail size={16} strokeWidth={1.8} />
                          </span>
                          <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                            placeholder="you@example.com" required
                            className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">New Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <Lock size={16} strokeWidth={1.8} />
                          </span>
                          <input type={showNewPass ? 'text' : 'password'} value={newPass} onChange={e => setNewPass(e.target.value)}
                            placeholder="••••••••" required minLength={6}
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                          <button type="button" onClick={() => setShowNewPass(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors">
                            {showNewPass ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                          </button>
                        </div>
                      </div>

                      <div>
                        <label className="block text-[11px] font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Confirm Password</label>
                        <div className="relative">
                          <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400 pointer-events-none">
                            <CheckCircle2 size={16} strokeWidth={1.8} />
                          </span>
                          <input type={showConfirm ? 'text' : 'password'} value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                            placeholder="••••••••" required minLength={6}
                            className="w-full pl-10 pr-10 py-3 border border-gray-200 rounded-xl text-sm text-gray-700
                                       placeholder:text-gray-300 bg-gray-50/60
                                       focus:outline-none focus:border-emerald-400 focus:bg-white focus:ring-2 focus:ring-emerald-100 transition-all" />
                          <button type="button" onClick={() => setShowConfirm(v => !v)}
                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-emerald-500 transition-colors">
                            {showConfirm ? <EyeOff size={16} strokeWidth={1.8} /> : <Eye size={16} strokeWidth={1.8} />}
                          </button>
                        </div>
                      </div>

                      {errorMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-red-600 bg-red-50 border border-red-200 px-3 py-2 rounded-xl">
                          <AlertCircle size={14} className="shrink-0" /> {errorMsg}
                        </motion.p>
                      )}
                      {successMsg && (
                        <motion.p initial={{ opacity: 0, y: -4 }} animate={{ opacity: 1, y: 0 }}
                          className="flex items-center gap-1.5 text-xs font-semibold text-green-700 bg-green-50 border border-green-200 px-3 py-2 rounded-xl">
                          <CheckCircle2 size={14} className="shrink-0" /> {successMsg}
                        </motion.p>
                      )}

                      <motion.button type="submit" disabled={resetting}
                        whileHover={{ scale: 1.015, boxShadow: '0 8px 28px rgba(5,150,105,0.4)' }}
                        whileTap={{ scale: 0.985 }}
                        transition={{ type: 'spring', stiffness: 400, damping: 20 }}
                        className="w-full py-3 bg-gradient-to-r from-emerald-500 to-emerald-700 text-white text-sm font-bold
                                   rounded-xl shadow-lg shadow-emerald-200 transition-all disabled:opacity-60 cursor-pointer
                                   flex items-center justify-center gap-1.5">
                        {resetting ? 'Resetting…' : <>Reset Password <ArrowRight size={15} /></>}
                      </motion.button>

                      <button type="button" onClick={() => switchView('login')}
                        className="w-full py-2 text-[12px] text-gray-400 hover:text-emerald-600 font-medium transition-colors flex items-center justify-center gap-1">
                        <ArrowLeft size={14} strokeWidth={2} />
                        Back to Sign In
                      </button>
                    </form>
                  </motion.div>
                )}

              </AnimatePresence>
            </div>
          </div>
        </div>

      </motion.div>
    </div>
  );
}
