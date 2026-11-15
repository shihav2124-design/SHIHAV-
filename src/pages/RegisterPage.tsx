import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  sendEmailVerification,
  signInWithPopup,
  updateProfile,
} from 'firebase/auth';
import { ArrowRight, Eye, EyeOff, Lock, Mail, Phone, Tag, User } from 'lucide-react';
import { auth, firebaseConfig } from '@/src/lib/firebase';
import { ensureUserAndWallet } from '@/src/lib/firestoreService';
import { useApp } from '@/src/context/AppContext';
import { BrandLogo } from '@/src/components/BrandLogo';

export function RegisterPage() {
  const { language, setLanguage, tr, showToast, siteSettings } = useApp();
  const navigate = useNavigate();

  const [fullName, setFullName] = useState('');
  const [username, setUsername] = useState('');
  const [mobile, setMobile] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [referralCode, setReferralCode] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    if (!siteSettings.registrationOpen) {
      setErrorMsg('New registrations are temporarily paused by the administrator.');
      return;
    }

    if (password.length < 6) {
      setErrorMsg('Password must be at least 6 characters long.');
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg('Passwords do not match.');
      return;
    }
    const cleanUser = username.trim();
    if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(cleanUser)) {
      setErrorMsg('Username must be 3–40 characters using letters, numbers, dots, underscores, or hyphens.');
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await ensureUserAndWallet(cred.user, {
        fullName: fullName.trim(),
        username: cleanUser,
        mobile: mobile.trim(),
        referralCode: referralCode.trim(),
        language,
      });
      await sendEmailVerification(cred.user).catch(() => {});
      showToast(
        language === 'bn'
          ? 'অ্যাকাউন্ট তৈরি হয়েছে! অনুগ্রহ করে ইমেইল ভেরিফাই করুন।'
          : 'Account created! Check your email to verify your account.',
        'success'
      );
      navigate('/user.html');
    } catch (err: any) {
      const code = err?.code || '';
      if (code === 'auth/operation-not-allowed') {
        setErrorMsg(
          language === 'bn'
            ? `Firebase Console ("${firebaseConfig.projectId}")-এ Email/Password সাইন-আপ এখনো চালু করা হয়নি। Authentication -> Sign-in method থেকে Email/Password চালু করুন, অথবা নিচের "গুগল দিয়ে চালিয়ে যান" বাটন ব্যবহার করুন।`
            : `Email/Password sign-up is not enabled yet in Firebase Console ("${firebaseConfig.projectId}"). Please enable Email/Password under Authentication -> Sign-in method, or use Continue with Google below.`
        );
      } else if (code === 'auth/email-already-in-use') {
        setErrorMsg(language === 'bn' ? 'এই ইমেইল দিয়ে ইতিমধ্যে অ্যাকাউন্ট খোলা আছে।' : 'This email address is already registered.');
      } else {
        setErrorMsg(err?.message || 'Registration failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    if (!siteSettings.registrationOpen) {
      setErrorMsg('New registrations are temporarily paused by the administrator.');
      return;
    }
    setLoading(true);
    setErrorMsg('');
    try {
      const cred = await signInWithPopup(auth, new GoogleAuthProvider());
      await ensureUserAndWallet(cred.user, { language });
      showToast(language === 'bn' ? 'গুগল সাইন-ইন সফল হয়েছে।' : 'Signed in with Google.', 'success');
      navigate('/user.html');
    } catch (err: any) {
      const host = typeof window !== 'undefined' ? window.location.hostname : 'this domain';
      if (err?.code === 'auth/unauthorized-domain') {
        setErrorMsg(
          language === 'bn'
            ? `ডোমেইন "${host}" এখনো Firebase Authorized Domains-এ যুক্ত করা হয়নি। Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains-এ "${host}" যোগ করুন।`
            : `Domain "${host}" is not authorized yet. Add "${host}" in Firebase Console ("${firebaseConfig.projectId}") -> Authentication -> Settings -> Authorized domains.`
        );
      } else {
        setErrorMsg(err?.message || 'Google sign-up failed.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-10 px-4 sm:px-6">
      <div className="max-w-xl w-full mx-auto bg-white rounded-2xl border border-slate-200 p-6 sm:p-10 space-y-6">
        <div className="flex items-center justify-between">
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
          <h1 className="font-display text-2xl font-bold text-slate-900">
            {language === 'bn' ? 'নতুন অ্যাকাউন্ট খুলুন' : 'Create your account'}
          </h1>
          <p className="text-sm text-slate-500 mt-1">
            {language === 'bn'
              ? 'দৈনিক টাস্ক সম্পন্ন করে আয় শুরু করতে তথ্যগুলো পূরণ করুন।'
              : 'Complete your details below to activate your earning wallet and task desk.'}
          </p>
        </div>

        {errorMsg && (
          <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800">
            {errorMsg}
          </div>
        )}

        <form onSubmit={handleRegister} className="space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('fullName')}</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="Tariqul Islam"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('username')}</label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="text"
                  required
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  placeholder="tariq_bd"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('mobileNumber')}</label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="tel"
                  required
                  value={mobile}
                  onChange={(e) => setMobile(e.target.value)}
                  placeholder="017XXXXXXXX"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('email')}</label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('password')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showPass ? 'text' : 'password'}
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
                <button
                  type="button"
                  onClick={() => setShowPass(!showPass)}
                  aria-label="Toggle password"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400"
                >
                  {showPass ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('confirmPassword')}</label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                <input
                  type={showConfirm ? 'text' : 'password'}
                  required
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full pl-10 pr-10 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  aria-label="Toggle confirm password"
                  className="absolute right-2 top-1/2 -translate-y-1/2 min-w-[32px] min-h-[32px] flex items-center justify-center text-slate-400"
                >
                  {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('referralCode')}</label>
            <div className="relative">
              <Tag className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={referralCode}
                onChange={(e) => setReferralCode(e.target.value)}
                placeholder="Optional referral code"
                className="w-full pl-10 pr-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
            </div>
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors disabled:opacity-60 min-h-[44px]"
          >
            <span>{loading ? 'Creating account...' : tr('register')}</span>
            <ArrowRight className="w-4 h-4" />
          </button>
        </form>

        <button
          type="button"
          onClick={handleGoogleSignUp}
          disabled={loading}
          className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold min-h-[44px]"
        >
          {tr('continueWithGoogle')}
        </button>

        <p className="text-center text-sm text-slate-600">
          {language === 'bn' ? 'ইতিমধ্যে অ্যাকাউন্ট আছে?' : 'Already have an account?'}{' '}
          <Link to="/login.html" className="font-semibold text-pink-600 hover:text-pink-700">
            {tr('login')}
          </Link>
        </p>
      </div>
    </div>
  );
}
