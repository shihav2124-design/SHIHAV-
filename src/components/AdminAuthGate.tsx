import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  LogOut,
  Mail,
  RefreshCw,
  ShieldCheck,
  UserPlus,
  X,
} from 'lucide-react';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
} from 'firebase/auth';
import { auth, BOOTSTRAPPED_ADMIN_EMAIL, firebaseConfig } from '@/src/lib/firebase';
import { ensureUserAndWallet } from '@/src/lib/firestoreService';
import { useApp } from '@/src/context/AppContext';
import { BrandLogo } from '@/src/components/BrandLogo';

export function AdminAuthGate() {
  const {
    firebaseUser,
    isAdmin,
    language,
    setLanguage,
    siteSettings,
    showToast,
    refreshAuthUser,
    logout,
  } = useApp();

  const [mode, setMode] = useState<'login' | 'setup'>('login');
  const [email, setEmail] = useState(BOOTSTRAPPED_ADMIN_EMAIL);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [forgotOpen, setForgotOpen] = useState(false);
  const [resetEmail, setResetEmail] = useState(BOOTSTRAPPED_ADMIN_EMAIL);
  const [resetSending, setResetSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const bn = language === 'bn';

  const formatAuthError = (err: any) => {
    const code = err?.code || '';
    const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';

    if (code === 'auth/operation-not-allowed') {
      return bn
        ? `Firebase Console ("${firebaseConfig.projectId}")-এ Email/Password লগইন এখনো চালু করা হয়নি। Authentication -> Sign-in method থেকে Email/Password চালু করুন, অথবা নিচের "গুগল দিয়ে অ্যাডমিন লগইন" বাটন ব্যবহার করুন।`
        : `Email/Password sign-in is not yet enabled in Firebase Console ("${firebaseConfig.projectId}"). Enable Email/Password under Authentication -> Sign-in method, or use Continue with Admin Google below.`;
    }
    if (code === 'auth/unauthorized-domain') {
      return bn
        ? `ডোমেইন "${host}" এখনো Firebase Authorized Domains-এ যুক্ত করা হয়নি। Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains-এ "${host}" যোগ করুন।`
        : `Domain "${host}" is not authorized yet. Add "${host}" in Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains.`;
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
      return bn
        ? 'ইমেইল অথবা পাসওয়ার্ড সঠিক নয়। আপনি যদি প্রথমবার পাসওয়ার্ড সেট করতে চান, তবে নিচের Google বাটন দিয়ে ঢুকে Admin Security Profile থেকে পাসওয়ার্ড সেট করুন অথবা "পাসওয়ার্ড সেটআপ" ট্যাব ব্যবহার করুন।'
        : 'Invalid email or password. If no password is set yet for this admin Gmail, sign in with Google below and set your password inside Admin & Audit Logs -> Admin Security Profile, or use Password Reset.';
    }
    if (code === 'auth/email-already-in-use') {
      return bn
        ? 'এই অ্যাডমিন ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট রয়েছে। সরাসরি লগইন করুন অথবা পাসওয়ার্ড রিসেট লিংক পাঠান।'
        : 'An account with this admin email already exists. Switch to Sign In or send a password reset link.';
    }
    return err?.message || 'Authentication failed.';
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserAndWallet(cred.user);
      showToast(bn ? 'অ্যাডমিন লগইন সম্পন্ন হয়েছে।' : 'Signed in successfully.', 'success');
    } catch (err: any) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleCreateAdminPasswordAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    if (password.length < 6) {
      setErrorMsg(bn ? 'পাসওয়ার্ড কমপক্ষে ৬ অক্ষরের হতে হবে।' : 'Password must be at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(bn ? 'দুটি পাসওয়ার্ড মিলছে না।' : 'Passwords do not match.');
      return;
    }
    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserAndWallet(cred.user, { fullName: 'Platform Admin', username: 'admin', language });
      await sendEmailVerification(cred.user).catch(() => {});
      showToast(
        bn
          ? 'অ্যাডমিন অ্যাকাউন্ট তৈরি হয়েছে! ইমেইলে পাঠানো লিংক থেকে ভেরিফাই করুন।'
          : 'Admin account created! Check your inbox to verify your email.',
        'success'
      );
    } catch (err: any) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleAdminSignIn = async () => {
    setErrorMsg('');
    setLoading(true);
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserAndWallet(cred.user);
      showToast(bn ? 'গুগল অ্যাডমিন লগইন সফল হয়েছে।' : 'Signed in with Google.', 'success');
    } catch (err: any) {
      setErrorMsg(formatAuthError(err));
    } finally {
      setLoading(false);
    }
  };

  const handleSendReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) return;
    setResetSending(true);
    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      showToast(
        bn ? 'পাসওয়ার্ড সেট/রিসেট লিংক ইমেইলে পাঠানো হয়েছে।' : 'Password setup/reset email sent.',
        'success'
      );
      setForgotOpen(false);
    } catch (err: any) {
      showToast(formatAuthError(err), 'error');
    } finally {
      setResetSending(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setVerifying(true);
    try {
      await sendEmailVerification(firebaseUser);
      showToast(bn ? 'ভেরিফিকেশন ইমেইল পাঠানো হয়েছে।' : 'Verification email sent.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not send verification email.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRefreshVerify = async () => {
    setVerifying(true);
    try {
      const ok = await refreshAuthUser();
      if (ok) {
        showToast(bn ? 'ইমেইল ভেরিফিকেশন সম্পন্ন হয়েছে!' : 'Email verified!', 'success');
      } else {
        showToast(
          bn ? 'এখনো ভেরিফাই হয়নি। ইনবক্সের লিংকে ক্লিক করে আবার চেষ্টা করুন।' : 'Not verified yet. Click the inbox link first.',
          'info'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 grid grid-cols-1 lg:grid-cols-12">
      {/* Left Admin Dark Navy Showcase */}
      <div className="hidden lg:flex lg:col-span-5 bg-navy-950 text-white p-12 flex-col justify-between border-r border-slate-800">
        <div className="flex items-center justify-between">
          <BrandLogo dark />
          <div className="inline-flex items-center bg-white/10 rounded-lg p-0.5 text-xs font-semibold">
            <button
              type="button"
              onClick={() => setLanguage('en')}
              className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                language === 'en' ? 'bg-white text-navy-950' : 'text-white/80 hover:text-white'
              }`}
            >
              EN
            </button>
            <button
              type="button"
              onClick={() => setLanguage('bn')}
              className={`px-2.5 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                language === 'bn' ? 'bg-white text-navy-950' : 'text-white/80 hover:text-white'
              }`}
            >
              বাংলা
            </button>
          </div>
        </div>

        <div className="space-y-6 max-w-md">
          <p className="text-xs font-mono text-pink-400 tracking-wide">
            {siteSettings.brandName} · Admin Control Portal
          </p>
          <h1 className="font-display text-3xl font-bold leading-tight text-balance">
            {bn ? 'অ্যাডমিন প্যানেল ও ম্যানেজমেন্ট ডেস্ক' : 'Central Operations & Financial Control'}
          </h1>
          <p className="text-sm text-slate-300 leading-relaxed">
            {bn
              ? 'ইউজার, দৈনিক গ্রুপ টাস্ক, ডিপোজিট, উইথড্রয়াল, ওয়ালেট লেজার এবং মার্কেটপ্লেস সরাসরি নিয়ন্ত্রণ করুন।'
              : 'Manage daily group TikTok tasks, deposit verifications, withdrawal payouts, wallet adjustments, and platform branding from one secure console.'}
          </p>

          <div className="bg-navy-900 border border-slate-800 rounded-2xl p-5 space-y-3 text-xs">
            <p className="font-semibold text-white">
              {bn ? 'নির্ধারিত সুপার অ্যাডমিন জিমেইল' : 'Designated Super Admin Gmail'}
            </p>
            <p className="font-mono text-sm text-pink-400 break-all">{BOOTSTRAPPED_ADMIN_EMAIL}</p>
            <p className="text-slate-400 leading-relaxed">
              {bn
                ? 'এই জিমেইল দিয়ে পাসওয়ার্ড অথবা Google Login-এর মাধ্যমে অ্যাডমিন প্যানেলে প্রবেশ করতে পারবেন।'
                : 'Sign in with this verified Gmail via Password or Google Sign-In to unlock full Admin Panel controls.'}
            </p>
          </div>
        </div>

        <Link
          to="/user.html"
          className="inline-flex items-center gap-2 text-xs font-semibold text-slate-300 hover:text-white transition-colors w-fit"
        >
          <ArrowLeft className="w-4 h-4" />
          <span>{bn ? 'ইউজার ইন্টারফেসে ফিরে যান' : 'Return to User Interface'}</span>
        </Link>
      </div>

      {/* Right Admin Auth Card */}
      <div className="lg:col-span-7 flex flex-col justify-center p-5 sm:p-10 bg-white">
        <div className="max-w-md w-full mx-auto space-y-6">
          {/* Mobile Header */}
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

          {/* Case A: Signed in as Admin Email but Email Not Verified */}
          {firebaseUser && !firebaseUser.emailVerified && (
            <div className="bg-amber-50 border border-amber-200 rounded-2xl p-6 space-y-4">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-amber-100 text-amber-700 flex items-center justify-center shrink-0">
                  <Mail className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-bold text-slate-900">
                    {bn ? 'অ্যাডমিন ইমেইল ভেরিফিকেশন প্রয়োজন' : 'Admin Email Verification Required'}
                  </h2>
                  <p className="text-xs font-mono text-slate-600">{firebaseUser.email}</p>
                </div>
              </div>
              <p className="text-xs sm:text-sm text-slate-700 leading-relaxed">
                {bn
                  ? 'নিরাপত্তার জন্য অ্যাডমিন প্যানেলে প্রবেশ করতে ইমেইলটি ভেরিফাই থাকতে হবে। আপনার ইনবক্সের লিংকে ক্লিক করুন অথবা সরাসরি Google দিয়ে সাইন-ইন করুন।'
                  : 'For database security, the admin account email must be verified before accessing Admin Console controls.'}
              </p>
              <div className="flex flex-col gap-2.5">
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleResendVerification}
                  className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-semibold min-h-[44px]"
                >
                  {bn ? 'ভেরিফিকেশন ইমেইল পাঠান' : 'Send Verification Email'}
                </button>
                <button
                  type="button"
                  disabled={verifying}
                  onClick={handleRefreshVerify}
                  className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs sm:text-sm font-semibold inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <RefreshCw className="w-4 h-4" />
                  <span>{bn ? 'ভেরিফাই করেছি — প্রবেশ করুন' : 'I Have Verified — Continue'}</span>
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-700 text-xs font-semibold min-h-[42px]"
                >
                  {bn ? 'লগআউট করুন' : 'Sign Out'}
                </button>
              </div>
            </div>
          )}

          {/* Case B: Signed in with a Non-Admin Account */}
          {firebaseUser && firebaseUser.emailVerified && !isAdmin && (
            <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-4">
              <div className="w-11 h-11 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center">
                <ShieldCheck className="w-6 h-6" />
              </div>
              <div className="space-y-1">
                <h2 className="font-display text-xl font-bold text-slate-900">
                  {bn ? 'অ্যাডমিন অনুমোদন প্রয়োজন' : 'Admin Authorization Required'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">
                  {bn
                    ? `আপনি বর্তমানে "${firebaseUser.email}" দিয়ে লগইন আছেন, যা সাধারণ ইউজার অ্যাকাউন্ট। অ্যাডমিন প্যানেলে প্রবেশ করতে "${BOOTSTRAPPED_ADMIN_EMAIL}" দিয়ে লগইন করুন।`
                    : `You are currently signed in as "${firebaseUser.email}". Sign out and sign in with "${BOOTSTRAPPED_ADMIN_EMAIL}" or an assigned admin account.`}
                </p>
              </div>
              <div className="flex flex-col gap-2.5 pt-1">
                <button
                  type="button"
                  onClick={logout}
                  className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 min-h-[44px]"
                >
                  <LogOut className="w-4 h-4" />
                  <span>{bn ? 'লগআউট করে অ্যাডমিন অ্যাকাউন্টে ঢুকুন' : 'Sign Out & Switch to Admin Account'}</span>
                </button>
                <Link
                  to="/user.html"
                  className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-700 text-sm font-semibold text-center min-h-[44px] flex items-center justify-center"
                >
                  {bn ? 'ইউজার ড্যাশবোর্ডে ফিরে যান' : 'Go to User Dashboard'}
                </Link>
              </div>
            </div>
          )}

          {/* Case C: Logged Out -> Show Admin Login / First-Time Password Setup */}
          {!firebaseUser && (
            <>
              <div className="space-y-2">
                <p className="text-xs font-mono font-semibold text-pink-600">
                  /admin · {siteSettings.brandName}
                </p>
                <h2 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
                  {bn ? 'অ্যাডমিন প্যানেল লগইন' : 'Admin Panel Sign In'}
                </h2>
                <p className="text-xs sm:text-sm text-slate-500 leading-relaxed">
                  {bn
                    ? 'অ্যাডমিনের জিমেইল ও পাসওয়ার্ড দিয়ে অথবা সরাসরি Admin Google দিয়ে প্রবেশ করুন।'
                    : 'Sign in with your designated admin Gmail and password, or continue with Google.'}
                </p>
              </div>

              {/* Mode Switcher: Sign In vs First-Time Password Account Creation */}
              <div className="grid grid-cols-2 gap-1 p-1 bg-slate-100 rounded-xl text-xs font-semibold">
                <button
                  type="button"
                  onClick={() => {
                    setMode('login');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
                    mode === 'login' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {bn ? 'অ্যাডমিন লগইন' : 'Admin Sign In'}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setMode('setup');
                    setErrorMsg('');
                  }}
                  className={`py-2 px-3 rounded-lg transition-colors whitespace-nowrap ${
                    mode === 'setup' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {bn ? 'পাসওয়ার্ড সেটআপ' : 'First-Time Password'}
                </button>
              </div>

              {errorMsg && (
                <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800 leading-relaxed">
                  {errorMsg}
                </div>
              )}

              {mode === 'login' ? (
                <form onSubmit={handleEmailLogin} className="space-y-4">
                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        {bn ? 'অ্যাডমিন জিমেইল' : 'Admin Gmail / Email'}
                      </label>
                      <button
                        type="button"
                        onClick={() => setEmail(BOOTSTRAPPED_ADMIN_EMAIL)}
                        className="text-[11px] font-semibold text-pink-600 hover:underline"
                      >
                        {bn ? 'অ্যাডমিন জিমেইল বসান' : 'Use Default Admin'}
                      </button>
                    </div>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder={BOOTSTRAPPED_ADMIN_EMAIL}
                        className="w-full pl-10 pr-4 py-2.5 rounded-xl border border-slate-200 text-sm text-slate-900 focus:outline-none focus:border-pink-600 focus:ring-2 focus:ring-pink-600/15"
                      />
                    </div>
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-semibold text-slate-700">
                        {bn ? 'পাসওয়ার্ড' : 'Password'}
                      </label>
                      <button
                        type="button"
                        onClick={() => {
                          setResetEmail(email || BOOTSTRAPPED_ADMIN_EMAIL);
                          setForgotOpen(true);
                        }}
                        className="text-xs font-semibold text-pink-600 hover:text-pink-700"
                      >
                        {bn ? 'পাসওয়ার্ড সেট / রিসেট?' : 'Set / Reset Password?'}
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
                    className="w-full py-3 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 min-h-[44px]"
                  >
                    <span>
                      {loading
                        ? bn
                          ? 'প্রবেশ করা হচ্ছে...'
                          : 'Signing in...'
                        : bn
                        ? 'অ্যাডমিন প্যানেলে লগইন করুন'
                        : 'Sign In to Admin Panel'}
                    </span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </form>
              ) : (
                <form onSubmit={handleCreateAdminPasswordAccount} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 text-xs text-slate-700 space-y-1.5 leading-relaxed">
                    <p className="font-semibold text-slate-900">
                      {bn ? 'প্রথমবার জিমেইল + পাসওয়ার্ড চালু করার নিয়ম:' : 'First-Time Gmail + Password Setup:'}
                    </p>
                    <p>
                      {bn
                        ? `১) Firebase Console (${firebaseConfig.projectId}) -> Authentication -> Sign-in method থেকে "Email/Password" চালু করুন। ২) তারপর নিচে আপনার পছন্দের পাসওয়ার্ড দিয়ে অ্যাকাউন্ট তৈরি করুন (অথবা নিচের Google বাটনে ঢুকে Admin Security Profile থেকে পাসওয়ার্ড সেট করুন)।`
                        : `1) Enable "Email/Password" under Firebase Console (${firebaseConfig.projectId}) -> Authentication -> Sign-in method. 2) Set your chosen password below, or sign in via Google first and set it under Admin & Audit Logs.`}
                    </p>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {bn ? 'অ্যাডমিন জিমেইল' : 'Admin Gmail'}
                    </label>
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {bn ? 'নতুন পাসওয়ার্ড দিন (কমপক্ষে ৬ অক্ষর)' : 'Choose Password (min 6 chars)'}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                      {bn ? 'পাসওয়ার্ড নিশ্চিত করুন' : 'Confirm Password'}
                    </label>
                    <input
                      type={showPassword ? 'text' : 'password'}
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 min-h-[44px]"
                  >
                    <UserPlus className="w-4 h-4" />
                    <span>{loading ? 'Creating...' : bn ? 'অ্যাডমিন পাসওয়ার্ড তৈরি করুন' : 'Create Admin Password Login'}</span>
                  </button>
                </form>
              )}

              <div className="relative flex items-center py-1">
                <div className="flex-grow border-t border-slate-200" />
                <span className="shrink mx-3 text-xs text-slate-400 font-medium">OR</span>
                <div className="flex-grow border-t border-slate-200" />
              </div>

              <button
                type="button"
                disabled={loading}
                onClick={handleGoogleAdminSignIn}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 bg-white hover:bg-slate-50 text-slate-900 text-sm font-semibold flex items-center justify-center gap-2.5 transition-colors min-h-[44px]"
              >
                <CheckCircle2 className="w-4 h-4 text-pink-600" />
                <span>
                  {bn ? 'গুগল দিয়ে অ্যাডমিন লগইন করুন' : 'Sign in with Admin Google'}
                </span>
              </button>

              <div className="pt-2 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500">
                <Link to="/user.html" className="font-semibold text-slate-700 hover:text-pink-600 inline-flex items-center gap-1">
                  <ArrowLeft className="w-3.5 h-3.5" />
                  <span>{bn ? 'ইউজার প্যানেল' : 'User Interface'}</span>
                </Link>
                <span className="font-mono text-[11px] truncate max-w-[200px]">
                  {BOOTSTRAPPED_ADMIN_EMAIL}
                </span>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Password Setup / Reset Email Modal */}
      {forgotOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-3">
              <h3 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
                <KeyRound className="w-4 h-4 text-pink-600" />
                <span>{bn ? 'অ্যাডমিন পাসওয়ার্ড রিসেট / সেট' : 'Set / Reset Admin Password'}</span>
              </h3>
              <button
                type="button"
                onClick={() => setForgotOpen(false)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs sm:text-sm text-slate-600 mb-4 leading-relaxed">
              {bn
                ? 'অ্যাডমিন জিমেইল দিন — আপনার ইমেইলে নতুন পাসওয়ার্ড সেট করার লিংক পাঠানো হবে (Firebase Console-এ Email/Password চালু থাকলে এটি সাথে সাথে কাজ করবে)।'
                : 'Enter the admin Gmail address to receive a secure password setup/reset link.'}
            </p>
            <form onSubmit={handleSendReset} className="space-y-4">
              <input
                type="email"
                required
                value={resetEmail}
                onChange={(e) => setResetEmail(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono focus:outline-none focus:border-pink-600"
              />
              <button
                type="submit"
                disabled={resetSending}
                className="w-full py-2.5 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold min-h-[44px]"
              >
                {resetSending ? 'Sending...' : bn ? 'রিসেট লিংক পাঠান' : 'Send Password Link'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
