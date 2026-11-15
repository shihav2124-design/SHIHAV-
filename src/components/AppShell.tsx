import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { sendEmailVerification } from 'firebase/auth';
import {
  Bell,
  CheckCheck,
  Clock,
  Headphones,
  Home,
  ListChecks,
  MessageCircle,
  ShieldCheck,
  User as UserIcon,
  Wallet,
  X,
} from 'lucide-react';
import { useApp } from '@/src/context/AppContext';
import { BrandLogo } from '@/src/components/BrandLogo';
import { markNotificationRead } from '@/src/lib/firestoreService';
import { formatDateTime } from '@/src/lib/imageUtils';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '@/src/lib/firebase';

export function AppShell({ children }: { children: React.ReactNode }) {
  const {
    firebaseUser,
    profile,
    isAdmin,
    notifications,
    unreadCount,
    siteSettings,
    language,
    setLanguage,
    tr,
    showToast,
    refreshAuthUser,
    firebaseRulesNotice,
    logout,
  } = useApp();

  const location = useLocation();
  const [notifOpen, setNotifOpen] = useState(false);
  const [supportOpen, setSupportOpen] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const currentPath = location.pathname.replace(/\.html$/, '') || '/user';

  const isActive = (path: string) =>
    currentPath === path || (path === '/user' && (currentPath === '/' || currentPath === '/user'));

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setVerifying(true);
    try {
      await sendEmailVerification(firebaseUser);
      showToast(
        language === 'bn'
          ? 'ভেরিফিকেশন ইমেইল পাঠানো হয়েছে। ইনবক্স বা স্প্যাম ফোল্ডার চেক করুন।'
          : 'Verification email sent. Please check your inbox and spam folder.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not send verification email.', 'error');
    } finally {
      setVerifying(false);
    }
  };

  const handleRefreshVerify = async () => {
    setVerifying(true);
    try {
      const verified = await refreshAuthUser();
      if (verified) {
        showToast(
          language === 'bn' ? 'আপনার ইমেইল ভেরিফাই সম্পন্ন হয়েছে!' : 'Email verified successfully!',
          'success'
        );
      } else {
        showToast(
          language === 'bn'
            ? 'এখনো ভেরিফাই হয়নি। অনুগ্রহ করে ইমেইলের লিংকে ক্লিক করুন।'
            : 'Not verified yet. Please click the verification link in your email.',
          'info'
        );
      }
    } finally {
      setVerifying(false);
    }
  };

  if (profile?.status === 'blocked' && !isAdmin) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white rounded-2xl border border-slate-200 p-8 text-center">
          <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto mb-4">
            <ShieldCheck className="w-6 h-6" />
          </div>
          <h1 className="font-display text-xl font-bold text-slate-900 mb-2">
            {language === 'bn' ? 'অ্যাকাউন্ট স্থগিত করা হয়েছে' : 'Account Suspended'}
          </h1>
          <p className="text-sm text-slate-600 mb-6">
            {language === 'bn'
              ? 'নিরাপত্তা বা নীতিমালা কারণে আপনার অ্যাকাউন্টটি ব্লক করা হয়েছে। সাপোর্টের সাথে যোগাযোগ করুন।'
              : 'Your account has been restricted by an administrator. Contact support for assistance.'}
          </p>
          <div className="flex flex-col gap-3">
            <a
              href={siteSettings.supportLink || `https://wa.me/${siteSettings.whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition-colors"
            >
              {tr('supportWhatsApp')}
            </a>
            <button
              type="button"
              onClick={logout}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 text-slate-700 text-sm font-semibold hover:bg-slate-50"
            >
              {tr('logout')}
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (siteSettings.websiteStatus === 'maintenance' && !isAdmin) {
    return (
      <div className="min-h-screen bg-navy-900 text-white flex items-center justify-center p-6">
        <div className="max-w-lg w-full bg-navy-800 rounded-2xl border border-slate-700 p-8 text-center">
          <BrandLogo dark />
          <h1 className="font-display text-2xl font-bold mt-6 mb-3">
            {language === 'bn' ? 'সিস্টেম রক্ষণাবেক্ষণ চলছে' : 'Scheduled Maintenance'}
          </h1>
          <p className="text-slate-300 text-sm leading-relaxed mb-6">
            {language === 'bn'
              ? 'আমরা সিস্টেম আপডেট করছি। কিছুক্ষণ পর আবার চেষ্টা করুন।'
              : 'We are performing scheduled upgrades to keep your wallet and tasks fast and secure. Please check back shortly.'}
          </p>
          <button
            type="button"
            onClick={logout}
            className="px-5 py-2.5 rounded-xl bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 transition-colors"
          >
            {tr('logout')}
          </button>
        </div>
      </div>
    );
  }

  const navItems = [
    { path: '/user.html', match: '/user', label: tr('home') },
    { path: '/tasks.html', match: '/tasks', label: tr('tasks') },
    { path: '/wallet.html', match: '/wallet', label: tr('wallet') },
    { path: '/history', match: '/history', label: tr('history') },
    { path: '/marketplace/tiktok', match: '/marketplace', label: language === 'bn' ? 'মার্কেটপ্লেস' : 'Marketplace' },
  ];

  return (
    <div className="min-h-screen bg-slate-50 text-slate-900 pb-20 lg:pb-10">
      {/* Top Navigation Bar (Strict 3-zone contract) */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 h-14 sm:h-16 flex items-center justify-between gap-8">
          {/* Zone 1: Brand Wordmark */}
          <Link to="/user.html" className="focus-visible:outline-2 focus-visible:outline-pink-600 rounded-lg">
            <BrandLogo />
          </Link>

          {/* Zone 2: Clean Single-Line Nav Links (Desktop) */}
          <nav className="hidden lg:flex items-center gap-7 text-sm font-medium text-slate-600">
            {navItems.map((item) => {
              const active =
                item.match === '/marketplace'
                  ? currentPath.startsWith('/marketplace')
                  : isActive(item.match);
              return (
                <Link
                  key={item.path}
                  to={item.path}
                  className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                    active
                      ? 'text-pink-600 border-pink-600 font-semibold'
                      : 'border-transparent hover:text-slate-900'
                  }`}
                >
                  {item.label}
                </Link>
              );
            })}
            {isAdmin && (
              <Link
                to="/admin.html"
                className={`whitespace-nowrap shrink-0 py-1 border-b-2 transition-colors ${
                  currentPath === '/admin'
                    ? 'text-pink-600 border-pink-600 font-semibold'
                    : 'border-transparent text-navy-900 hover:text-pink-600 font-semibold'
                }`}
              >
                {tr('adminPanel')}
              </Link>
            )}
          </nav>

          {/* Zone 3: Single Compact Action Cluster */}
          <div className="flex items-center gap-2 shrink-0">
            <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5 text-xs font-semibold">
              <button
                type="button"
                onClick={() => setLanguage('en')}
                className={`px-2 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  language === 'en' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                EN
              </button>
              <button
                type="button"
                onClick={() => setLanguage('bn')}
                className={`px-2 py-1.5 rounded-md transition-colors whitespace-nowrap ${
                  language === 'bn' ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                বাংলা
              </button>
            </div>

            <button
              type="button"
              onClick={() => setSupportOpen(true)}
              aria-label={tr('supportWhatsApp')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-pink-600 hover:bg-pink-50 transition-colors"
            >
              <Headphones className="w-5 h-5" />
            </button>

            <button
              type="button"
              onClick={() => setNotifOpen(true)}
              aria-label="Notifications"
              className="relative min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl text-slate-600 hover:text-pink-600 hover:bg-pink-50 transition-colors"
            >
              <Bell className="w-5 h-5" />
              {unreadCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[16px] h-4 px-1 rounded-full bg-pink-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                  {unreadCount > 9 ? '9+' : unreadCount}
                </span>
              )}
            </button>

            {isAdmin && (
              <Link
                to="/admin.html"
                aria-label={tr('adminPanel')}
                className="lg:hidden min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-pink-50 text-pink-600 hover:bg-pink-100 transition-colors"
              >
                <ShieldCheck className="w-5 h-5" />
              </Link>
            )}

            <Link
              to="/profile.html"
              aria-label={tr('profile')}
              className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl bg-navy-900 text-white hover:bg-navy-800 transition-colors px-2.5 gap-2"
            >
              <UserIcon className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline text-xs font-semibold max-w-[100px] truncate">
                {profile?.username || tr('profile')}
              </span>
            </Link>
          </div>
        </div>
      </header>

      {/* Firestore Rules Setup Notice if rules not deployed yet */}
      {firebaseRulesNotice && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 text-sm text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="font-medium">{firebaseRulesNotice}</p>
          </div>
        </div>
      )}

      {/* Email Verification Reminder Banner */}
      {firebaseUser && !firebaseUser.emailVerified && (
        <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-4">
          <div className="bg-white border border-amber-300 rounded-2xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-bold text-slate-900">{tr('verifyEmailTitle')}</p>
              <p className="text-xs sm:text-sm text-slate-600">{tr('verifyEmailDesc')}</p>
            </div>
            <div className="flex items-center gap-2.5 shrink-0">
              <button
                type="button"
                disabled={verifying}
                onClick={handleResendVerification}
                className="px-4 py-2 rounded-xl bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 disabled:opacity-60 whitespace-nowrap min-h-[40px]"
              >
                {tr('resendVerification')}
              </button>
              <button
                type="button"
                disabled={verifying}
                onClick={handleRefreshVerify}
                className="px-4 py-2 rounded-xl border border-slate-200 bg-slate-50 text-slate-800 text-xs font-semibold hover:bg-slate-100 disabled:opacity-60 whitespace-nowrap min-h-[40px]"
              >
                {tr('refreshStatus')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Main Content Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 sm:pt-7">{children}</main>

      {/* Mobile Fixed Bottom Navigation (5 Tabs, <= 15% Viewport Height) */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white/95 backdrop-blur-md border-t border-slate-200 h-16"
      >
        <div className="grid grid-cols-5 h-full max-w-lg mx-auto">
          {[
            { path: '/user.html', match: '/user', label: tr('home'), icon: Home },
            { path: '/tasks.html', match: '/tasks', label: tr('tasks'), icon: ListChecks },
            { path: '/wallet.html', match: '/wallet', label: tr('wallet'), icon: Wallet },
            { path: '/history', match: '/history', label: tr('history'), icon: Clock },
            { path: '/profile.html', match: '/profile', label: tr('profile'), icon: UserIcon },
          ].map((tab) => {
            const Icon = tab.icon;
            const active = isActive(tab.match);
            return (
              <Link
                key={tab.path}
                to={tab.path}
                className={`flex flex-col items-center justify-center min-h-[44px] transition-colors ${
                  active ? 'text-pink-600 font-semibold' : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                <Icon className="w-5 h-5" />
                <span className="text-[11px] mt-0.5 leading-none truncate max-w-[64px]">{tab.label}</span>
              </Link>
            );
          })}
        </div>
      </nav>

      {/* Notifications Drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-md h-full flex flex-col border-l border-slate-200">
            <div className="p-5 border-b border-slate-200 flex items-center justify-between">
              <div>
                <h2 className="font-display text-lg font-bold text-slate-900">
                  {language === 'bn' ? 'নোটিফিকেশন' : 'Notifications'}
                </h2>
                <p className="text-xs text-slate-500">
                  {unreadCount} {language === 'bn' ? 'টি অপঠিত' : 'unread'}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setNotifOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto divide-y divide-slate-100">
              {notifications.length === 0 ? (
                <div className="p-8 text-center text-sm text-slate-500">{tr('noData')}</div>
              ) : (
                notifications.map((ntf) => (
                  <div
                    key={ntf.id}
                    className={`p-4 transition-colors ${ntf.read ? 'bg-white' : 'bg-pink-50/50'}`}
                  >
                    <div className="flex items-start justify-between gap-3">
                      <div className="space-y-1">
                        <p className="text-sm font-semibold text-slate-900">{ntf.title}</p>
                        <p className="text-xs text-slate-600 leading-relaxed">{ntf.message}</p>
                        <p className="text-[11px] text-slate-400 font-mono">{formatDateTime(ntf.createdAt)}</p>
                      </div>
                      {!ntf.read && (
                        <button
                          type="button"
                          onClick={() => markNotificationRead(ntf.id)}
                          title="Mark read"
                          className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg text-pink-600 hover:bg-pink-100"
                        >
                          <CheckCheck className="w-4 h-4" />
                        </button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Support Modal */}
      {supportOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-display text-lg font-bold text-slate-900">
                {language === 'bn' ? 'সাপোর্ট ও সহায়তা' : 'Help & Support Desk'}
              </h2>
              <button
                type="button"
                onClick={() => setSupportOpen(false)}
                className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-500"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="text-sm text-slate-600 mb-5 leading-relaxed">
              {language === 'bn'
                ? 'ডিপোজিট, উইথড্র, টাস্ক বা মার্কেটপ্লেস সংক্রান্ত যেকোনো সহায়তার জন্য সরাসরি অ্যাডমিন সাপোর্টে যোগাযোগ করুন।'
                : 'Need help with a task verification, deposit TrxID, withdrawal, or account transfer? Reach our support desk directly.'}
            </p>
            <div className="space-y-3">
              <a
                href={siteSettings.supportLink || `https://wa.me/${siteSettings.whatsappNumber.replace(/\D/g, '')}`}
                target="_blank"
                rel="noreferrer"
                className="w-full py-3 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <MessageCircle className="w-4 h-4" />
                <span>
                  {tr('supportWhatsApp')} ({siteSettings.whatsappNumber})
                </span>
              </a>
              <a
                href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
                className="w-full py-3 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
              >
                <Headphones className="w-4 h-4" />
                <span>
                  {tr('adminSupport')} · {BOOTSTRAPPED_ADMIN_EMAIL}
                </span>
              </a>
              {isAdmin && (
                <Link
                  to="/admin.html"
                  onClick={() => setSupportOpen(false)}
                  className="w-full py-3 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors"
                >
                  <ShieldCheck className="w-4 h-4" />
                  <span>{tr('adminPanel')}</span>
                </Link>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
