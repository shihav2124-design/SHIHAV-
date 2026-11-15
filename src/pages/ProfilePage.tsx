import React, { useState } from 'react';
import { Link } from 'react-router-dom';
import { sendEmailVerification, updatePassword } from 'firebase/auth';
import {
  CheckCircle2,
  Clock,
  Headphones,
  KeyRound,
  LogOut,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User as UserIcon,
  Wallet,
} from 'lucide-react';
import { useApp } from '@/src/context/AppContext';
import { updateUserProfileFields } from '@/src/lib/firestoreService';
import { formatDateTime } from '@/src/lib/imageUtils';
import { StatusText } from '@/src/components/StatusText';

export function ProfilePage() {
  const { firebaseUser, profile, isAdmin, siteSettings, language, tr, showToast, logout } = useApp();

  const [fullName, setFullName] = useState(profile?.fullName || '');
  const [username, setUsername] = useState(profile?.username || '');
  const [mobile, setMobile] = useState(profile?.mobile || '');
  const [savingProfile, setSavingProfile] = useState(false);

  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [savingPass, setSavingPass] = useState(false);
  const [avatarBroken, setAvatarBroken] = useState(false);

  const handleSaveProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setSavingProfile(true);
    try {
      await updateUserProfileFields(firebaseUser.uid, {
        fullName: fullName.trim() || profile?.fullName,
        username: username.trim() || profile?.username,
        mobile: mobile.trim(),
      });
      showToast('Profile updated successfully.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to update profile.', 'error');
    } finally {
      setSavingProfile(false);
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    if (newPassword.length < 6) {
      showToast('Password must be at least 6 characters.', 'error');
      return;
    }
    if (newPassword !== confirmPass) {
      showToast('Passwords do not match.', 'error');
      return;
    }
    setSavingPass(true);
    try {
      await updatePassword(firebaseUser, newPassword);
      showToast('Password updated successfully.', 'success');
      setNewPassword('');
      setConfirmPass('');
    } catch (err: any) {
      showToast(
        err?.code === 'auth/requires-recent-login'
          ? 'Please sign out and sign back in before changing your password.'
          : err?.message || 'Could not update password.',
        'error'
      );
    } finally {
      setSavingPass(false);
    }
  };

  const handleResendVerify = async () => {
    if (!firebaseUser) return;
    try {
      await sendEmailVerification(firebaseUser);
      showToast('Verification email sent.', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed to send verification email.', 'error');
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold text-slate-900">{tr('profile')}</h1>
        <p className="text-sm text-slate-500 mt-1">Manage your identity, security, and account preferences.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Account Overview Card */}
        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 space-y-5 h-fit">
          <div className="flex items-center gap-4">
            {!avatarBroken ? (
              <img
                src={profile?.photoURL || '/src/assets/images/user_default_avatar_1794590210375.jpg'}
                alt={profile?.fullName || 'User avatar'}
                referrerPolicy="no-referrer"
                onError={() => setAvatarBroken(true)}
                className="w-16 h-16 rounded-2xl object-cover border border-slate-200 shrink-0"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-navy-900 text-white flex items-center justify-center shrink-0">
                <UserIcon className="w-7 h-7" />
              </div>
            )}
            <div className="min-w-0">
              <h2 className="font-display text-lg font-bold text-slate-900 truncate">
                {profile?.fullName || 'Member'}
              </h2>
              <p className="text-xs font-mono text-slate-500 truncate">@{profile?.username}</p>
              <div className="mt-1">
                <StatusText status={profile?.status || 'active'} />
              </div>
            </div>
          </div>

          <div className="divide-y divide-slate-100 text-xs sm:text-sm">
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">User ID</span>
              <span className="font-mono text-slate-900 truncate max-w-[180px]">{firebaseUser?.uid}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5" /> Email
              </span>
              <span className="font-mono text-slate-900 truncate">{profile?.email}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500 inline-flex items-center gap-1.5">
                <Phone className="w-3.5 h-3.5" /> Mobile
              </span>
              <span className="font-mono text-slate-900">{profile?.mobile || 'Not set'}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">Referral Code</span>
              <span className="font-mono font-semibold text-pink-600">{profile?.myReferralCode || '—'}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">Joined</span>
              <span className="font-mono text-slate-700">{formatDateTime(profile?.createdAt)}</span>
            </div>
            <div className="py-2.5 flex items-center justify-between gap-2">
              <span className="text-slate-500">Email Verification</span>
              {firebaseUser?.emailVerified ? (
                <span className="inline-flex items-center gap-1 text-emerald-700 font-semibold text-xs">
                  <CheckCircle2 className="w-3.5 h-3.5" /> Verified
                </span>
              ) : (
                <button
                  type="button"
                  onClick={handleResendVerify}
                  className="text-xs font-semibold text-pink-600 hover:underline"
                >
                  Send Verification Link
                </button>
              )}
            </div>
          </div>

          {isAdmin && (
            <Link
              to="/admin.html"
              className="w-full py-3 px-4 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4 text-pink-400" />
              <span>{language === 'bn' ? 'অ্যাডমিন প্যানেলে প্রবেশ করুন' : 'Open Admin Panel'}</span>
            </Link>
          )}

          <div className="grid grid-cols-2 gap-2.5 pt-2">
            <Link
              to="/wallet.html"
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
            >
              <Wallet className="w-3.5 h-3.5 text-pink-600" />
              <span>Transactions</span>
            </Link>
            <Link
              to="/history"
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
            >
              <Clock className="w-3.5 h-3.5 text-navy-900" />
              <span>Task History</span>
            </Link>
            <a
              href={siteSettings.supportLink || `https://wa.me/${siteSettings.whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="py-2.5 px-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-800 flex items-center justify-center gap-1.5"
            >
              <Headphones className="w-3.5 h-3.5 text-emerald-600" />
              <span>Support</span>
            </a>
            <button
              type="button"
              onClick={logout}
              className="py-2.5 px-3 rounded-xl bg-rose-50 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center justify-center gap-1.5"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>{tr('logout')}</span>
            </button>
          </div>
        </section>

        {/* Edit Profile & Security Forms */}
        <div className="lg:col-span-7 space-y-6">
          <form onSubmit={handleSaveProfile} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900">Edit Profile</h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('fullName')}</label>
                <input
                  type="text"
                  value={fullName || profile?.fullName || ''}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('username')}</label>
                <input
                  type="text"
                  value={username || profile?.username || ''}
                  onChange={(e) => setUsername(e.target.value)}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">{tr('mobileNumber')}</label>
              <input
                type="tel"
                value={mobile || profile?.mobile || ''}
                onChange={(e) => setMobile(e.target.value)}
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
            </div>
            <button
              type="submit"
              disabled={savingProfile}
              className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
            >
              <Save className="w-4 h-4" />
              <span>{savingProfile ? 'Saving...' : 'Save Changes'}</span>
            </button>
          </form>

          <form onSubmit={handleChangePassword} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h3 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-pink-600" />
              <span>{language === 'bn' ? 'পাসওয়ার্ড পরিবর্তন করুন' : 'Change Password'}</span>
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">New Password</label>
                <input
                  type="password"
                  required
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Min 6 characters"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Confirm New Password</label>
                <input
                  type="password"
                  required
                  value={confirmPass}
                  onChange={(e) => setConfirmPass(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={savingPass}
              className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>{savingPass ? 'Updating...' : 'Update Password'}</span>
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
