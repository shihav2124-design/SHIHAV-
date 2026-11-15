import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  GoogleAuthProvider,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, Lock, Mail, ShieldCheck, X } from 'lucide-react';
import { auth, firebaseConfig } from '@/src/lib/firebase';
import { ensureUserAndWallet } from '@/src/lib/firestoreService';
import { useApp } from '@/src/context/AppContext';
import { BrandLogo } from '@/src/components/BrandLogo';

export function LoginPage() {
  const { language, setLanguage, tr, showToast, siteSettings } = useApp();
  const navigate = useNavigate();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetSending, setResetSending] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserAndWallet(cred.user);
      showToast(language === 'bn' ? 'স্বাগতম! লগইন সফল হয়েছে।' : 'Signed in successfully.', 'success');
      navigate('/user.html');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          language === 'bn'
            ? `Firebase Console ("${firebaseConfig.projectId}")-এ Email/Password লগইন এখনো চালু করা হয়নি। Authentication -> Sign-in method থেকে Email/Password চালু করুন, অথবা নিচের "গুগল দিয়ে চালিয়ে যান" বাটন ব্যবহার করুন।`
            : `Email/Password sign-in is not yet enabled in Firebase Console for project "${firebaseConfig.projectId}". Please enable Authentication -> Sign-in method -> Email/Password, or use Continue with Google.`
        );
      } else if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
        setErrorMsg(language === 'bn' ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়।' : 'Invalid email or password.');
      } else {
        setErrorMsg(err?.message || 'Sign in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const provider = new GoogleAuthProvider();
      const cred = await signInWithPopup(auth, provider);
      await ensureUserAndWallet(cred.user);
      showToast(language === 'bn' ? 'গুগল লগইন সফল হয়েছে।' : 'Signed in with Google.', 'success');
      navigate('/user.html');
    } catch (err: any) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      if (err?.code === 'auth/unauthorized-domain') {
        setErrorMsg(
          language === 'bn'
            ? `ডোমেইন "${host}" এখনো Firebase Authorized Domains-এ যুক্ত করা হয়নি। Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains-এ "${host}" যোগ করুন।`
            : `Domain "${host}" is not authorized yet. Add "${host}" in Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains.`
        );
      } else if (err?.code === 'auth/operation-not-allowed') {
        setErrorMsg(
          `Google Sign-In is not enabled in Firebase Console for project "${firebaseConfig.projectId}". Enable Google provider under Authentication -> Sign-in method.`
        );
      } else {
        setErrorMsg(err?.message || 'Google sign-in failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      showToast(
        language === 'bn'
          ? 'পাসওয়ার্ড রিসেট লিংক ইমেইলে পাঠানো হয়েছে।'
          : 'Password reset link sent to your email.',
        'success'
      );
      setForgotOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Failed to send reset email.', 'error');
    } finally {
      setResetSending(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Brand Showcase Panel */}
      <div className="hidden lg:flex lg:col-span-6 relative bg-navy-950 text-white p-12 flex-col justify-between overflow-hidden">
        <img
          src="/src/assets/images/fintech_promo_banner_1794590210337.jpg"
          alt="Fintech background visual"
          referrerPolicy="no-referrer"
          className="absolute inset-0 w-full h-full object-cover opacity-55"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/70 to-navy-950/40" />

        <div className="relative z-10 flex items-center justify-between">
          <BrandLogo dark />
          <div className="inline-flex items-center bg-white/10 backdrop-blur-md rounded-lg p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                language === 'en' ? 'bg-white text-navy-950' : 'text-white/80 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`px-2.5 py-1.5 rounded-md transition-colors ${
                language === 'bn' ? 'bg-white text-navy-950' : 'text-white/80 hover:text-white'
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>

        <div className="relative z-10 max-w-lg space-y-5">
          <h1 className="font-display text-4xl font-bold leading-tight tracking-tight text-balance">
            {siteSettings.bannerTitle}
          </h1>
          <p className="text-slate-300 text-base leading-relaxed">
            {siteSettings.bannerSubtitle}
          </p>
          <div className="grid grid-cols-3 gap-4 pt-4 border-t border-white/15 text-xs">
            <div>
              <p className="text-slate-400">Task Payouts</p>
              <p className="font-mono font-semibold text-white mt-1 text-sm">Instant Credit</p>
            </div>
            <div>
              <p className="text-slate-400">Payments</p>
              <p className="font-mono font-semibold text-white mt-1 text-sm">bKash · Nagad · Rocket</p>
            </div>
            <div>
              <p className="text-slate-400">Escrow Trade</p>
              <p className="font-mono font-semibold text-white mt-1 text-sm">TikTok &amp; Gmail IDs</p>
            </div>
          </div>
        </div>

        <p className="relative z-10 text-xs text-slate-400">
          {siteSettings.brandName} · Verified Financial Ledger &amp; Task Platform
        </p>
      </div>

      {/* Right Auth Form Panel */}
      <div className="lg:col-span-6 flex flex-col justify-center p-6 sm:p-10 lg:p-16 bg-white">
        <div className="max-w-md w-full mx-auto space-y-7">
          <div className="flex items-center justify-between lg:hidden">
            <BrandLogo />
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2.5 py-1.5 rounded-md ${language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('bn')}
                className={`px-2.5 py-1.5 rounded-md ${language === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600'}`}
              >
                বাংলা
              </button>
            </div>
          </div>

          <div>
            <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              {language === 'bn' ? 'আপনার অ্যাকাউন্টে লগইন করুন' : 'Sign in to your account'}
            </h2>
            <p className="text-sm text-slate-500 mt-1.5">
              {language === 'bn'
                ? 'টাস্ক, ওয়ালেট এবং মার্কেটপ্লেস অ্যাক্সেস করতে লগইন করুন।'
                : 'Access your earning wallet, assigned TikTok tasks, and escrow marketplace.'}
            </p>
          </div>

          {errorMsg && (
            <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 leading-relaxed">
              {errorMsg}
            </div>
          )}

          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                {tr('email')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-600/15"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="block text-xs font-semibold text-slate-700">
                  {tr('password')}
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setResetEmail(email);
                    setForgotOpen(true);
                  }}
                  className="text-xs font-semibold text-pink-600 hover:text-pink-700"
                >
                  {tr('forgotPassword')}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full pl-10 pr-11 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-600/15"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label="Toggle password visibility"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400 hover:text-slate-700"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 min-h-[44px]"
            >
              <span>{loading ? (language === 'bn' ? 'অপেক্ষা করুন...' : 'Signing in...') : tr('login')}</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </form>

          <div className="relative flex items-center py-1">
            <div className="flex-grow border-t border-slate-200" />
            <span className="shrink mx-3 text-xs text-slate-400 font-medium">OR</span>
            <div className="flex-grow border-t border-slate-200" />
          </div>

          <button
            type="button"
            disabled={loading}
            onClick={handleGoogleSignIn}
            className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors min-h-[44px]"
          >
            <ShieldCheck className="w-4 h-4 text-navy-900" />
            <span>{tr('continueWithGoogle')}</span>
          </button>

          <p className="text-center text-sm text-slate-600">
            {language === 'bn' ? 'নতুন ব্যবহারকারী?' : "Don't have an account?"}{' '}
            <Link to="/register.html" className="font-semibold text-pink-600 hover:text-pink-700">
              {tr('register')}
            </Link>
          </p>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">{tr('forgotPassword')}</h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mb-4">
              {language === 'bn'
                ? 'আপনার রেজিস্টার্ড ইমেইল দিন, আমরা পাসওয়ার্ড রিসেট লিংক পাঠাব।'
                : 'Enter your registered email address and we will send you a secure password reset link.'}
            </p>
            <form onSubmit={handleForgotPassword} className="space-y-4">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                placeholder="name@example.com"
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
              <button
                type="submit"
                disabled={resetSending}
                className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold min-h-[44px]"
              >
                {resetSending ? 'Sending...' : 'Send Reset Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
