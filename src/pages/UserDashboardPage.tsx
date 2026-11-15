import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { collection, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  ChevronRight,
  Eye,
  EyeOff,
  Headphones,
  ListChecks,
  Mail,
  Megaphone,
  MessageCircle,
  PlaySquare,
  ShieldCheck,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { TaskSubmission, TikTokTask, TransactionRecord } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';
import { BOOTSTRAPPED_ADMIN_EMAIL } from '@/src/lib/firebase';

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function UserDashboardPage() {
  const { firebaseUser, profile, wallet, siteSettings, language, tr, isAdmin } = useApp();
  const [balanceVisible, setBalanceVisible] = useState(false);
  const [tasks, setTasks] = useState<TikTokTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [unlockedGroup, setUnlockedGroup] = useState<string>('');

  const todayKey = getTodayDateKey();

  useEffect(() => {
    if (!firebaseUser) {
      setUnlockedGroup('');
      return;
    }
    try {
      const saved = localStorage.getItem(`pt_daily_group_${firebaseUser.uid}_${todayKey}`);
      const parsed = saved ? JSON.parse(saved) : null;
      setUnlockedGroup(parsed?.groupName || '');
    } catch {
      setUnlockedGroup('');
    }
  }, [firebaseUser, todayKey]);

  useEffect(() => {
    if (!firebaseUser) return;

    let unsubAllTasks = () => {};
    let unsubSpecificTasks = () => {};

    if (unlockedGroup.trim()) {
      const targetKey = unlockedGroup.trim().toLowerCase();
      unsubAllTasks = onSnapshot(
        query(collection(db, 'tasks'), where('assignMode', '==', 'all')),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as TikTokTask))
            .filter((t) => (t.groupNameKey || t.groupName || '').trim().toLowerCase() === targetKey);
          setTasks((prev) => {
            const map = new Map<string, TikTokTask>();
            prev.filter((t) => t.assignMode === 'specific').forEach((t) => map.set(t.id, t));
            list.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        },
        () => {}
      );

      unsubSpecificTasks = onSnapshot(
        query(collection(db, 'tasks'), where('assignedUserIds', 'array-contains', firebaseUser.uid)),
        (snap) => {
          const list = snap.docs
            .map((d) => ({ id: d.id, ...d.data() } as TikTokTask))
            .filter((t) => (t.groupNameKey || t.groupName || '').trim().toLowerCase() === targetKey);
          setTasks((prev) => {
            const map = new Map<string, TikTokTask>();
            prev.filter((t) => t.assignMode === 'all').forEach((t) => map.set(t.id, t));
            list.forEach((t) => map.set(t.id, t));
            return Array.from(map.values());
          });
        },
        () => {}
      );
    } else {
      setTasks([]);
    }

    const unsubSubs = onSnapshot(
      query(collection(db, 'taskSubmissions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskSubmission));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setSubmissions(list);
      },
      () => {}
    );

    const unsubTx = onSnapshot(
      query(collection(db, 'transactions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TransactionRecord));
        list.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        setTransactions(list);
      },
      () => {}
    );

    return () => {
      unsubAllTasks();
      unsubSpecificTasks();
      unsubSubs();
      unsubTx();
    };
  }, [firebaseUser, unlockedGroup]);

  const activeTasks = tasks.filter((t) => t.status === 'active').slice(0, 3);
  const subByTaskId = new Map(submissions.map((s) => [s.taskId, s]));

  const quickActions = [
    {
      label: tr('withdraw'),
      to: '/withdraw.html',
      icon: ArrowUpRight,
      tone: 'bg-pink-50 text-pink-600',
    },
    {
      label: tr('deposit'),
      to: '/deposit.html',
      icon: ArrowDownLeft,
      tone: 'bg-emerald-50 text-emerald-700',
    },
    {
      label: tr('tiktokBuy'),
      to: '/marketplace/tiktok?tab=buy',
      icon: PlaySquare,
      tone: 'bg-slate-100 text-navy-900',
    },
    {
      label: tr('tiktokSell'),
      to: '/marketplace/tiktok?tab=sell',
      icon: PlaySquare,
      tone: 'bg-pink-50 text-pink-700',
    },
    {
      label: tr('gmailBuy'),
      to: '/marketplace/gmail?tab=buy',
      icon: Mail,
      tone: 'bg-sky-50 text-sky-700',
    },
    {
      label: tr('gmailSell'),
      to: '/marketplace/gmail?tab=sell',
      icon: Mail,
      tone: 'bg-amber-50 text-amber-700',
    },
  ];

  return (
    <div className="space-y-6">
      {/* Greeting & Balance Hero Section */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* Main Balance Card (bKash-inspired tap-to-reveal) */}
        <section className="lg:col-span-7 bg-navy-900 text-white rounded-3xl p-6 sm:p-7 flex flex-col justify-between relative overflow-hidden">
          <div className="absolute right-0 top-0 w-56 h-56 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
          <div className="relative z-10 flex items-start justify-between gap-4">
            <div>
              <p className="text-xs font-medium text-slate-300">
                {language === 'bn' ? 'স্বাগতম,' : 'Welcome back,'}{' '}
                <span className="text-white font-semibold">{profile?.fullName || 'Member'}</span>
              </p>
              <p className="text-xs text-slate-400 font-mono mt-0.5">
                @{profile?.username || 'member'} · ID {firebaseUser?.uid.slice(0, 8)}
              </p>
            </div>
            {isAdmin && (
              <Link
                to="/admin.html"
                className="px-3.5 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap shrink-0"
              >
                <ShieldCheck className="w-3.5 h-3.5" />
                <span>{tr('adminPanel')}</span>
              </Link>
            )}
          </div>

          <div className="relative z-10 my-6">
            <p className="text-xs text-slate-300 mb-2">{tr('availableBalance')}</p>
            <div className="flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={() => setBalanceVisible((v) => !v)}
                className="inline-flex items-center gap-3 px-4 py-2.5 rounded-2xl bg-white/10 hover:bg-white/15 border border-white/15 transition-all active:scale-[0.99] min-h-[48px]"
              >
                <span className="w-7 h-7 rounded-full bg-pink-600 text-white flex items-center justify-center shrink-0">
                  {balanceVisible ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </span>
                <span className="font-mono text-2xl sm:text-3xl font-bold tracking-tight tabular-nums">
                  {balanceVisible ? formatCurrency(wallet?.availableBalance) : '৳ ••••••'}
                </span>
                <span className="text-xs font-medium text-pink-200 whitespace-nowrap">
                  {balanceVisible ? tr('hideBalance') : tr('tapForBalance')}
                </span>
              </button>
            </div>
          </div>

          <div className="relative z-10 grid grid-cols-2 sm:grid-cols-4 gap-4 pt-4 border-t border-white/15">
            <div>
              <p className="text-[11px] text-slate-400">{tr('totalEarnings')}</p>
              <p className="font-mono text-sm sm:text-base font-semibold tabular-nums mt-0.5">
                {formatCurrency(wallet?.totalEarned)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{tr('pendingEarnings')}</p>
              <p className="font-mono text-sm sm:text-base font-semibold tabular-nums mt-0.5 text-amber-300">
                {formatCurrency(wallet?.pendingBalance)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{tr('totalWithdrawals')}</p>
              <p className="font-mono text-sm sm:text-base font-semibold tabular-nums mt-0.5">
                {formatCurrency(wallet?.totalWithdrawn)}
              </p>
            </div>
            <div>
              <p className="text-[11px] text-slate-400">{tr('totalDeposits')}</p>
              <p className="font-mono text-sm sm:text-base font-semibold tabular-nums mt-0.5">
                {formatCurrency(wallet?.totalDeposited)}
              </p>
            </div>
          </div>
        </section>

        {/* Announcements Banner Card */}
        <section className="lg:col-span-5 relative rounded-3xl overflow-hidden bg-navy-950 text-white p-6 flex flex-col justify-between min-h-[230px]">
          <img
            src="/src/assets/images/fintech_promo_banner_1794590210337.jpg"
            alt="Platform announcement"
            referrerPolicy="no-referrer"
            className="absolute inset-0 w-full h-full object-cover opacity-50"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-navy-950 via-navy-950/75 to-navy-950/45" />

          <div className="relative z-10 flex items-center gap-2 text-pink-300 text-xs font-semibold">
            <Megaphone className="w-4 h-4" />
            <span>{tr('announcements')}</span>
          </div>

          <div className="relative z-10 space-y-2 my-4">
            <h2 className="font-display text-lg sm:text-xl font-bold leading-snug text-balance">
              {siteSettings.bannerTitle}
            </h2>
            <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
              {siteSettings.noticeText}
            </p>
          </div>

          <div className="relative z-10 flex items-center gap-3">
            <Link
              to="/tasks.html"
              className="px-4 py-2 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {tr('dailyTasks')}
            </Link>
            <Link
              to="/wallet.html"
              className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-semibold transition-colors whitespace-nowrap"
            >
              {tr('wallet')}
            </Link>
          </div>
        </section>
      </div>

      {/* Quick Action Buttons */}
      <section className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
        <h2 className="font-display text-base font-bold text-slate-900 mb-4">{tr('quickActions')}</h2>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {quickActions.map((act) => {
            const Icon = act.icon;
            return (
              <Link
                key={act.to}
                to={act.to}
                className="group p-4 rounded-2xl border border-slate-100 hover:border-pink-200 hover:bg-pink-50/30 transition-all flex flex-col items-center text-center gap-2.5 min-h-[104px] justify-center"
              >
                <span className={`w-11 h-11 rounded-2xl flex items-center justify-center ${act.tone} transition-transform group-hover:scale-105`}>
                  <Icon className="w-5 h-5" />
                </span>
                <span className="text-xs sm:text-sm font-semibold text-slate-800 leading-tight">
                  {act.label}
                </span>
              </Link>
            );
          })}
        </div>
      </section>

      {/* Assigned Daily Tasks & Recent History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Daily Tasks */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-slate-900 flex items-center gap-2">
              <ListChecks className="w-4 h-4 text-pink-600" />
              <span>{tr('dailyTasks')}</span>
            </h2>
            <div className="flex items-center gap-3">
              <Link to="/tasks.html?tab=my-tasks" className="text-xs font-semibold text-navy-900 hover:text-pink-600">
                {tr('myTasks')} ({submissions.length})
              </Link>
              <Link to="/tasks.html" className="text-xs font-semibold text-pink-600 hover:text-pink-700 inline-flex items-center gap-1">
                <span>{tr('viewAll')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          </div>

          {!unlockedGroup ? (
            <div className="py-8 px-4 rounded-2xl bg-slate-50 border border-slate-200 text-center space-y-3">
              <p className="text-sm font-semibold text-slate-900">
                {language === 'bn'
                  ? 'আজকের টাস্ক দেখতে গ্রুপের নাম দিন'
                  : 'Daily Group Name Required'}
              </p>
              <p className="text-xs text-slate-500 max-w-sm mx-auto leading-relaxed">
                {language === 'bn'
                  ? 'নিরাপত্তা ও পেমেন্ট হিসাবের জন্য টাস্ক পেজে গিয়ে আজকের গ্রুপের নাম লিখলেই টিকটক ইউজারনেম দেখতে পাবেন।'
                  : 'Enter your assigned Group Name on the Tasks page to reveal today’s TikTok usernames and claim projects.'}
              </p>
              <Link
                to="/tasks.html"
                className="inline-flex items-center gap-1.5 px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold transition-colors"
              >
                <span>{tr('unlockTasks')}</span>
                <ChevronRight className="w-3.5 h-3.5" />
              </Link>
            </div>
          ) : activeTasks.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">
              {language === 'bn' ? 'এই গ্রুপে কোনো নতুন টাস্ক নেই।' : 'No active TikTok tasks found for this group.'}
            </div>
          ) : (
            <div className="divide-y divide-slate-100">
              {activeTasks.map((task) => {
                const sub = subByTaskId.get(task.id);
                return (
                  <Link
                    key={task.id}
                    to="/tasks.html"
                    className="py-3.5 flex items-center justify-between gap-4 hover:bg-slate-50 -mx-2 px-2 rounded-xl transition-colors"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">{task.title}</p>
                      <p className="text-xs text-slate-500 mt-0.5 truncate">
                        {task.groupName} · {task.tiktokUsername} · {task.taskType.replace('_', ' ')} · Due {task.deadline}
                      </p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="font-mono text-sm font-bold text-pink-600 tabular-nums">
                        +{formatCurrency(task.commission)}
                      </p>
                      <div className="mt-0.5">
                        <StatusText status={sub ? sub.status : 'available'} />
                      </div>
                    </div>
                  </Link>
                );
              })}
            </div>
          )}
        </section>

        {/* Recent Transactions */}
        <section className="lg:col-span-6 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-slate-900">{tr('recentTransactions')}</h2>
            <Link to="/wallet.html" className="text-xs font-semibold text-pink-600 hover:text-pink-700 inline-flex items-center gap-1">
              <span>{tr('viewAll')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {transactions.length === 0 ? (
            <div className="py-10 text-center text-sm text-slate-500">{tr('noData')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {transactions.slice(0, 5).map((tx) => (
                <div key={tx.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{tx.description}</p>
                    <p className="text-xs text-slate-400 font-mono mt-0.5">
                      {tx.txCode} · {formatDateTime(tx.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p
                      className={`font-mono text-sm font-bold tabular-nums ${
                        tx.amount >= 0 ? 'text-emerald-700' : 'text-slate-900'
                      }`}
                    >
                      {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                    </p>
                    <StatusText status={tx.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* Recent Task History & Support Strip */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display text-base font-bold text-slate-900">{tr('recentTasks')}</h2>
            <Link to="/history" className="text-xs font-semibold text-pink-600 hover:text-pink-700 inline-flex items-center gap-1">
              <span>{tr('viewAll')}</span>
              <ChevronRight className="w-3.5 h-3.5" />
            </Link>
          </div>

          {submissions.length === 0 ? (
            <div className="py-8 text-center text-sm text-slate-500">{tr('noData')}</div>
          ) : (
            <div className="divide-y divide-slate-100">
              {submissions.slice(0, 4).map((sub) => (
                <div key={sub.id} className="py-3 flex items-center justify-between gap-4">
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{sub.taskTitle}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {sub.tiktokUsername} · {formatDateTime(sub.createdAt)}
                    </p>
                  </div>
                  <div className="text-right shrink-0">
                    <p className="font-mono text-sm font-semibold text-slate-900 tabular-nums">
                      {formatCurrency(sub.commission)}
                    </p>
                    <StatusText status={sub.status} />
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between gap-4">
          <div>
            <h2 className="font-display text-base font-bold text-slate-900">
              {language === 'bn' ? 'সরাসরি সহায়তা কেন্দ্র' : 'Dedicated Support & Helpdesk'}
            </h2>
            <p className="text-xs sm:text-sm text-slate-500 mt-1 leading-relaxed">
              {language === 'bn'
                ? 'যেকোনো পেমেন্ট বা অ্যাকাউন্ট সংক্রান্ত প্রশ্নের জন্য আমাদের সাপোর্ট টিমের সাথে যোগাযোগ করুন।'
                : 'Have a question about task verification, deposits, or account escrow? Reach us directly.'}
            </p>
          </div>

          <div className="space-y-2.5">
            <a
              href={siteSettings.supportLink || `https://wa.me/${siteSettings.whatsappNumber.replace(/\D/g, '')}`}
              target="_blank"
              rel="noreferrer"
              className="w-full py-2.5 px-4 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <MessageCircle className="w-4 h-4" />
              <span>
                {tr('supportWhatsApp')} · {siteSettings.whatsappNumber}
              </span>
            </a>
            <a
              href={`mailto:${BOOTSTRAPPED_ADMIN_EMAIL}`}
              className="w-full py-2.5 px-4 rounded-xl border border-slate-200 hover:bg-slate-50 text-slate-800 text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
            >
              <Headphones className="w-4 h-4 text-pink-600" />
              <span>{tr('adminSupport')}</span>
            </a>
          </div>
        </section>
      </div>
    </div>
  );
}
