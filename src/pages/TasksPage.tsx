import React, { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { collection, getDocs, onSnapshot, query, where } from 'firebase/firestore';
import {
  ArrowRight,
  Briefcase,
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  FolderCheck,
  ImagePlus,
  KeyRound,
  Layers,
  Lock,
  RefreshCw,
  Send,
  Upload,
  Users,
  X,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { claimTaskProject, submitTaskProof, updateUserProfileFields } from '@/src/lib/firestoreService';
import { compressImageToDataUrl, copyText, formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import { TaskSubmission, TikTokTask } from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

function getTodayDateKey(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function TasksPage() {
  const { firebaseUser, profile, language, tr, showToast } = useApp();
  const [searchParams, setSearchParams] = useSearchParams();
  const initialTab = searchParams.get('tab') === 'my-tasks' ? 'my-tasks' : 'tasks';

  const [activeTab, setActiveTab] = useState<'tasks' | 'my-tasks'>(initialTab);
  const [tasks, setTasks] = useState<TikTokTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [filter, setFilter] = useState<'all' | 'available' | 'claimed' | 'submitted' | 'approved' | 'rejected'>('all');
  const [myFilter, setMyFilter] = useState<'all' | 'claimed' | 'submitted' | 'approved' | 'rejected'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  const todayKey = getTodayDateKey();
  const storageKey = firebaseUser ? `pt_daily_group_${firebaseUser.uid}_${todayKey}` : '';

  const [unlockedGroup, setUnlockedGroup] = useState<string>('');
  const [groupInput, setGroupInput] = useState<string>('');
  const [unlocking, setUnlocking] = useState(false);
  const [groupError, setGroupError] = useState<string>('');
  const [claimingId, setClaimingId] = useState<string | null>(null);

  const [modalTarget, setModalTarget] = useState<{
    task?: TikTokTask;
    submission?: TaskSubmission;
  } | null>(null);
  const [proofPreview, setProofPreview] = useState<string>('');
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [proofViewer, setProofViewer] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'my-tasks') setActiveTab('my-tasks');
    else if (tabParam === 'tasks') setActiveTab('tasks');
  }, [searchParams]);

  // Restore today's unlocked group if already entered today
  useEffect(() => {
    if (!storageKey) return;
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (parsed?.groupName) {
          setUnlockedGroup(parsed.groupName);
          setGroupInput(parsed.groupName);
        }
      } else {
        setUnlockedGroup('');
      }
    } catch {
      setUnlockedGroup('');
    }
  }, [storageKey]);

  // Subscribe to user's own submissions ("My Tasks")
  useEffect(() => {
    if (!firebaseUser) return;
    const unsubSubs = onSnapshot(
      query(collection(db, 'taskSubmissions'), where('userId', '==', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs.map((d) => ({ id: d.id, ...d.data() } as TaskSubmission));
        list.sort((a, b) => (b.updatedAt?.toMillis?.() || b.createdAt?.toMillis?.() || 0) - (a.updatedAt?.toMillis?.() || a.createdAt?.toMillis?.() || 0));
        setSubmissions(list);
      },
      () => {}
    );
    return () => unsubSubs();
  }, [firebaseUser]);

  // Subscribe to tasks ONLY after today's Group Name is unlocked!
  useEffect(() => {
    if (!firebaseUser || !unlockedGroup.trim()) {
      setTasks([]);
      return;
    }

    const targetKey = unlockedGroup.trim().toLowerCase();

    const unsubAll = onSnapshot(
      query(collection(db, 'tasks'), where('assignMode', '==', 'all')),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TikTokTask))
          .filter((t) => (t.groupNameKey || t.groupName || '').trim().toLowerCase() === targetKey);
        setTasks((prev) => {
          const map = new Map<string, TikTokTask>();
          prev.filter((t) => t.assignMode === 'specific').forEach((t) => map.set(t.id, t));
          list.forEach((t) => map.set(t.id, t));
          return Array.from(map.values()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        });
      },
      () => {}
    );

    const unsubSpec = onSnapshot(
      query(collection(db, 'tasks'), where('assignedUserIds', 'array-contains', firebaseUser.uid)),
      (snap) => {
        const list = snap.docs
          .map((d) => ({ id: d.id, ...d.data() } as TikTokTask))
          .filter((t) => (t.groupNameKey || t.groupName || '').trim().toLowerCase() === targetKey);
        setTasks((prev) => {
          const map = new Map<string, TikTokTask>();
          prev.filter((t) => t.assignMode === 'all').forEach((t) => map.set(t.id, t));
          list.forEach((t) => map.set(t.id, t));
          return Array.from(map.values()).sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));
        });
      },
      () => {}
    );

    return () => {
      unsubAll();
      unsubSpec();
    };
  }, [firebaseUser, unlockedGroup]);

  const handleUnlockGroup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    const raw = groupInput.trim();
    if (!raw) {
      setGroupError(
        language === 'bn'
          ? 'অনুগ্রহ করে আপনার গ্রুপের নাম লিখুন।'
          : 'Please enter your assigned Group Name.'
      );
      return;
    }

    const key = raw.toLowerCase();
    setUnlocking(true);
    setGroupError('');
    try {
      const [allSnap, specSnap] = await Promise.all([
        getDocs(query(collection(db, 'tasks'), where('assignMode', '==', 'all'))),
        getDocs(query(collection(db, 'tasks'), where('assignedUserIds', 'array-contains', firebaseUser.uid))),
      ]);

      const merged = [...allSnap.docs, ...specSnap.docs].map(
        (d) => ({ id: d.id, ...d.data() } as TikTokTask)
      );
      const matched = merged.filter(
        (t) =>
          (t.groupNameKey || t.groupName || '').trim().toLowerCase() === key &&
          t.status === 'active'
      );

      if (matched.length === 0) {
        setGroupError(
          language === 'bn'
            ? `"${raw}" গ্রুপ নামে কোনো অ্যাক্টিভ টাস্ক পাওয়া যায়নি। অ্যাডমিন বা টিম লিডারের দেওয়া সঠিক গ্রুপ নেম লিখুন।`
            : `No active tasks found for Group Name "${raw}". Verify today's Group Name with your team leader or admin.`
        );
        return;
      }

      const canonicalName = matched[0].groupName || raw;
      setUnlockedGroup(canonicalName);
      if (storageKey) {
        localStorage.setItem(storageKey, JSON.stringify({ groupName: canonicalName, date: todayKey }));
      }
      // Save activeGroupName on user profile for admin payment & group lead tracking
      updateUserProfileFields(firebaseUser.uid, { activeGroupName: canonicalName }).catch(() => {});

      showToast(
        language === 'bn'
          ? `"${canonicalName}" গ্রুপের ${matched.length}টি টাস্ক আনলক হয়েছে!`
          : `Unlocked ${matched.length} task(s) for group "${canonicalName}".`,
        'success'
      );
    } catch (err: any) {
      setGroupError(err?.message || 'Could not verify Group Name.');
    } finally {
      setUnlocking(false);
    }
  };

  const handleLockOrSwitchGroup = () => {
    setUnlockedGroup('');
    setGroupError('');
    if (storageKey) localStorage.removeItem(storageKey);
  };

  const subMap = useMemo(() => new Map(submissions.map((s) => [s.taskId, s])), [submissions]);
  const taskMap = useMemo(() => new Map(tasks.map((t) => [t.id, t])), [tasks]);

  const getEffectiveStatus = (task: TikTokTask): string => {
    const sub = subMap.get(task.id);
    if (sub) return sub.status;
    if (task.status === 'expired') return 'expired';
    if (task.deadline && new Date(task.deadline).getTime() < Date.now() - 86400000) return 'expired';
    if (task.status !== 'active') return 'expired';
    return 'available';
  };

  const filteredTasks = tasks.filter((task) => {
    const st = getEffectiveStatus(task);
    if (filter === 'all') return true;
    if (filter === 'available') return st === 'available';
    if (filter === 'claimed') return st === 'claimed';
    if (filter === 'submitted') return st === 'submitted' || st === 'under_review';
    if (filter === 'approved') return st === 'approved';
    if (filter === 'rejected') return st === 'rejected';
    return true;
  });

  const filteredMyTasks = submissions.filter((sub) => {
    if (myFilter === 'all') return true;
    if (myFilter === 'claimed') return sub.status === 'claimed';
    if (myFilter === 'submitted') return sub.status === 'submitted' || sub.status === 'under_review';
    if (myFilter === 'approved') return sub.status === 'approved';
    if (myFilter === 'rejected') return sub.status === 'rejected';
    return true;
  });

  // My Tasks Analytics & Group Accounting
  const myStats = useMemo(() => {
    const totalTaken = submissions.length;
    const completed = submissions.filter((s) => s.status === 'approved').length;
    const inProgress = submissions.filter((s) => s.status === 'claimed').length;
    const inReview = submissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;
    const earned = submissions.filter((s) => s.commissionPaid).reduce((acc, s) => acc + s.commission, 0);
    const completionPct = totalTaken > 0 ? Math.round((completed / totalTaken) * 100) : 0;

    const byGroup = new Map<string, { group: string; taken: number; completed: number; earned: number }>();
    submissions.forEach((s) => {
      const g = s.groupName || 'Standard';
      const cur = byGroup.get(g) || { group: g, taken: 0, completed: 0, earned: 0 };
      cur.taken += 1;
      if (s.status === 'approved') cur.completed += 1;
      if (s.commissionPaid) cur.earned += s.commission;
      byGroup.set(g, cur);
    });

    return {
      totalTaken,
      completed,
      inProgress,
      inReview,
      earned,
      completionPct,
      groupSummary: Array.from(byGroup.values()),
    };
  }, [submissions]);

  const handleCopyUsername = async (id: string, username: string) => {
    await copyText(username);
    setCopiedId(id);
    showToast(`${tr('copied')}: ${username}`, 'info');
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleTakeProject = async (task: TikTokTask) => {
    if (!profile || !firebaseUser) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }
    setClaimingId(task.id);
    try {
      await claimTaskProject({ task, user: profile });
      showToast(
        language === 'bn'
          ? 'প্রজেক্টটি আপনার "মাই টাস্ক"-এ যুক্ত হয়েছে! এবার লাইক/ফলো করে স্ক্রিনশট জমা দিন।'
          : 'Project added to My Tasks! Complete the action and upload your proof.',
        'success'
      );
    } catch (err: any) {
      showToast(err?.message || 'Could not take project.', 'error');
    } finally {
      setClaimingId(null);
    }
  };

  const handleImageSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const compressed = await compressImageToDataUrl(file);
      setProofPreview(compressed);
    } catch (err: any) {
      showToast(err?.message || 'Could not process image', 'error');
    }
  };

  const handleSubmitTask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!modalTarget || !profile || !firebaseUser) return;
    if (!firebaseUser.emailVerified) {
      showToast(tr('verifyEmailDesc'), 'error');
      return;
    }
    if (!proofPreview) {
      showToast(
        language === 'bn' ? 'অনুগ্রহ করে স্ক্রিনশট প্রমাণ আপলোড করুন।' : 'Please upload a screenshot proof.',
        'error'
      );
      return;
    }

    const existingSub = modalTarget.submission || (modalTarget.task ? subMap.get(modalTarget.task.id) : undefined);
    const shouldUpdate = existingSub?.status === 'claimed' || existingSub?.status === 'rejected';

    setSubmitting(true);
    try {
      await submitTaskProof({
        task: modalTarget.task,
        submission: modalTarget.submission || existingSub,
        user: profile,
        proofImageData: proofPreview,
        note,
        isResubmit: shouldUpdate,
      });
      showToast(
        language === 'bn'
          ? 'টাস্কের প্রমাণ সফলভাবে জমা হয়েছে! অ্যাডমিন যাচাইয়ের পর কমিশন যোগ হবে।'
          : 'Task proof submitted! Commission will be credited upon admin verification.',
        'success'
      );
      setModalTarget(null);
      setProofPreview('');
      setNote('');
    } catch (err: any) {
      showToast(err?.message || 'Submission failed.', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const actionLabel = (type: string) => {
    if (type === 'like') return language === 'bn' ? 'ভিডিও লাইক' : 'Like Video';
    if (type === 'follow') return language === 'bn' ? 'প্রোফাইল ফলো' : 'Follow Profile';
    if (type === 'like_follow') return language === 'bn' ? 'ফলো ও লাইক' : 'Follow & Like';
    return language === 'bn' ? 'বিশেষ টাস্ক' : 'Custom Action';
  };

  const switchMainTab = (tab: 'tasks' | 'my-tasks') => {
    setActiveTab(tab);
    setSearchParams({ tab });
  };

  const modalTitle = modalTarget?.task?.title || modalTarget?.submission?.taskTitle || '';
  const modalUsername = modalTarget?.task?.tiktokUsername || modalTarget?.submission?.tiktokUsername || '';
  const modalCommission = modalTarget?.task?.commission || modalTarget?.submission?.commission || 0;
  const modalGroup = modalTarget?.task?.groupName || modalTarget?.submission?.groupName || '';

  // SVG Circular Ring math
  const ringRadius = 26;
  const ringCirc = 2 * Math.PI * ringRadius;
  const ringOffset = ringCirc - (myStats.completionPct / 100) * ringCirc;

  return (
    <div className="space-y-6">
      {/* Executive Dark Navy Workspace Header */}
      <section className="bg-navy-950 text-white rounded-3xl p-6 sm:p-8 relative overflow-hidden">
        <div className="absolute -right-12 -top-12 w-72 h-72 bg-pink-600/20 rounded-full blur-3xl pointer-events-none" />
        <div className="relative z-10 flex flex-col lg:flex-row lg:items-center justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="flex flex-wrap items-center gap-2 text-xs text-pink-300 font-medium">
              <span>{language === 'bn' ? 'দৈনিক গ্রুপ ওয়ার্কস্পেস' : 'Daily Group Workspace'}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-slate-300">{todayKey}</span>
              <span aria-hidden="true">·</span>
              <span className="font-mono text-white">
                {unlockedGroup
                  ? `${tr('groupName')}: ${unlockedGroup}`
                  : language === 'bn'
                  ? 'গ্রুপ লকড'
                  : 'Group Locked'}
              </span>
            </div>

            <h1 className="font-display text-2xl sm:text-3xl font-bold tracking-tight text-balance">
              {activeTab === 'tasks'
                ? language === 'bn'
                  ? 'দৈনিক টিকটক টাস্ক ডেস্ক'
                  : 'Daily TikTok Task Desk'
                : language === 'bn'
                ? 'মাই টাস্ক এবং প্রজেক্ট ট্র্যাকার'
                : 'My Tasks & Project Tracker'}
            </h1>

            <p className="text-xs sm:text-sm text-slate-300 leading-relaxed">
              {activeTab === 'tasks'
                ? language === 'bn'
                  ? 'সঠিক গ্রুপ নেম দিয়ে আজকের টিকটক ইউজারনেম আনলক করুন, প্রজেক্ট নিন এবং স্ক্রিনশট প্রমাণ জমা দিন।'
                  : 'Verify your daily Group Name to reveal assigned TikTok usernames, claim projects, and submit completion screenshots.'
                : language === 'bn'
                ? 'আপনার নেওয়া লাইক ও ফলো প্রজেক্ট, কমপ্লিশন সংখ্যা এবং গ্রুপভিত্তিক পেমেন্ট হিসাব এখানে দেখুন।'
                : 'Track every Like & Follow project you claimed, monitor completed count, and view group-wise earnings.'}
            </p>

            {/* Primary Mode Switch: Tasks vs My Tasks */}
            <div className="pt-1">
              <div className="inline-flex items-center p-1 bg-white/10 border border-white/10 rounded-xl">
                <button
                  type="button"
                  onClick={() => switchMainTab('tasks')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap min-h-[40px] ${
                    activeTab === 'tasks'
                      ? 'bg-pink-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" />
                  <span>{tr('tasks')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => switchMainTab('my-tasks')}
                  className={`px-4 py-2 rounded-lg text-xs sm:text-sm font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap min-h-[40px] ${
                    activeTab === 'my-tasks'
                      ? 'bg-pink-600 text-white'
                      : 'text-slate-300 hover:text-white'
                  }`}
                >
                  <Briefcase className="w-4 h-4 shrink-0" />
                  <span>{tr('myTasks')}</span>
                  <span className="font-mono text-xs px-1.5 py-0.5 rounded-md bg-white/15 tabular-nums">
                    {myStats.totalTaken}
                  </span>
                </button>
              </div>
            </div>
          </div>

          {/* Live Completion Progress Ring & Tabular Summary */}
          <div className="bg-white/5 border border-white/10 rounded-2xl p-4 sm:p-5 flex items-center gap-5 shrink-0">
            <div className="relative w-16 h-16 flex items-center justify-center shrink-0">
              <svg className="w-16 h-16 -rotate-90" viewBox="0 0 64 64" aria-hidden="true">
                <circle
                  cx="32"
                  cy="32"
                  r={ringRadius}
                  stroke="rgba(255,255,255,0.12)"
                  strokeWidth="6"
                  fill="none"
                />
                <circle
                  cx="32"
                  cy="32"
                  r={ringRadius}
                  stroke="#EC4899"
                  strokeWidth="6"
                  strokeLinecap="round"
                  fill="none"
                  strokeDasharray={ringCirc}
                  strokeDashoffset={ringOffset}
                  className="transition-all duration-300"
                />
              </svg>
              <span className="absolute font-mono text-xs font-bold text-white tabular-nums">
                {myStats.completionPct}%
              </span>
            </div>

            <div className="grid grid-cols-2 gap-x-6 gap-y-2 text-xs">
              <div>
                <p className="text-slate-400">{language === 'bn' ? 'কমপ্লিট' : 'Completed'}</p>
                <p className="font-mono text-base font-bold text-white tabular-nums">
                  {myStats.completed} / {myStats.totalTaken}
                </p>
              </div>
              <div>
                <p className="text-slate-400">{language === 'bn' ? 'টাস্ক আয়' : 'Task Earned'}</p>
                <p className="font-mono text-base font-bold text-pink-300 tabular-nums">
                  {formatCurrency(myStats.earned)}
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =================================================================== */}
      {/* TAB 1: DAILY GROUP TASKS                                            */}
      {/* =================================================================== */}
      {activeTab === 'tasks' && (
        <>
          {!unlockedGroup ? (
            /* GROUP ACCESS GATE (Hides all TikTok usernames until valid Group Name is submitted) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
              <section className="lg:col-span-5 bg-white rounded-2xl border border-slate-200 p-6 sm:p-7 flex flex-col justify-between gap-6">
                <div className="space-y-4">
                  <div className="w-12 h-12 rounded-2xl bg-pink-50 text-pink-600 flex items-center justify-center">
                    <Lock className="w-6 h-6" />
                  </div>
                  <h2 className="font-display text-xl font-bold text-slate-900">
                    {language === 'bn'
                      ? 'টাস্ক আনলক করতে গ্রুপ নেম দিন'
                      : 'Daily Group Access Verification'}
                  </h2>
                  <p className="text-sm text-slate-600 leading-relaxed">
                    {language === 'bn'
                      ? 'নতুন বা পুরোনো সকল মেম্বারের জন্য পেমেন্ট ও লিডার হিসাব ঠিক রাখতে প্রতিদিন কাজের আগে আপনার গ্রুপের নাম দেওয়া বাধ্যতামূলক। গ্রুপ নেম দিলে শুধু আপনার গ্রুপের টিকটক ইউজারনেমগুলো দেখা যাবে।'
                      : 'To keep group leader tracking and payout accounting accurate, TikTok usernames stay hidden until you enter today’s assigned Group Name.'}
                  </p>
                </div>

                <div className="divide-y divide-slate-100 border-t border-slate-100 pt-2 text-xs text-slate-600">
                  <div className="py-2.5 flex items-center justify-between">
                    <span>{language === 'bn' ? '০১. দৈনিক যাচাই' : '01. Daily Check'}</span>
                    <span className="font-mono font-semibold text-slate-900">{todayKey}</span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span>{language === 'bn' ? '০২. সর্বশেষ গ্রুপ' : '02. Last Recorded Group'}</span>
                    <span className="font-mono font-semibold text-pink-600">
                      {profile?.activeGroupName || '—'}
                    </span>
                  </div>
                  <div className="py-2.5 flex items-center justify-between">
                    <span>{language === 'bn' ? '০৩. আমার নেওয়া প্রজেক্ট' : '03. Your Taken Projects'}</span>
                    <button
                      type="button"
                      onClick={() => switchMainTab('my-tasks')}
                      className="font-semibold text-navy-900 hover:text-pink-600 inline-flex items-center gap-1"
                    >
                      <span>{myStats.totalTaken} {language === 'bn' ? 'টি দেখুন' : 'View'}</span>
                      <ArrowRight className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              </section>

              <section className="lg:col-span-7 bg-white rounded-2xl border border-slate-200 p-6 sm:p-8 flex flex-col justify-center">
                <form onSubmit={handleUnlockGroup} className="space-y-5 max-w-xl">
                  <div>
                    <p className="text-xs font-semibold text-pink-600 mb-1">
                      {language === 'bn' ? 'স্টেপ ১ · গ্রুপ ভেরিফিকেশন' : 'Step 1 · Group Verification'}
                    </p>
                    <h3 className="font-display text-lg sm:text-xl font-bold text-slate-900">
                      {tr('enterGroupName')}
                    </h3>
                  </div>

                  {groupError && (
                    <div className="p-3.5 rounded-xl bg-rose-50 border border-rose-200 text-xs sm:text-sm text-rose-800">
                      {groupError}
                    </div>
                  )}

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-2">
                      {tr('groupName')}
                    </label>
                    <div className="relative">
                      <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-1/2 -translate-y-1/2" />
                      <input
                        type="text"
                        required
                        value={groupInput}
                        onChange={(e) => setGroupInput(e.target.value)}
                        placeholder={language === 'bn' ? 'যেমন: TEAM-ALPHA বা আপনার গ্রুপের নাম' : 'e.g. TEAM-ALPHA or assigned group name'}
                        className="w-full pl-10 pr-4 py-3 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-pink-600"
                      />
                    </div>
                    <p className="text-xs text-slate-500 mt-2">
                      {language === 'bn'
                        ? 'সঠিক গ্রুপ নেম লিখলে আপনার জন্য নির্ধারিত টিকটক আইডি, লাইক/ফলো নির্দেশনা ও কমিশন কার্ড ওপেন হবে।'
                        : 'Entering the exact Group Name reveals the TikTok usernames, Like/Follow instructions, and commissions assigned to your group.'}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-3 pt-1">
                    <button
                      type="submit"
                      disabled={unlocking}
                      className="px-6 py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center justify-center gap-2 transition-colors disabled:opacity-60 min-h-[46px]"
                    >
                      <span>{unlocking ? (language === 'bn' ? 'যাচাই হচ্ছে...' : 'Verifying...') : tr('unlockTasks')}</span>
                      <ArrowRight className="w-4 h-4" />
                    </button>

                    {profile?.activeGroupName && !groupInput && (
                      <button
                        type="button"
                        onClick={() => setGroupInput(profile.activeGroupName || '')}
                        className="px-4 py-3 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 min-h-[46px]"
                      >
                        {language === 'bn' ? `আগের গ্রুপ ব্যবহার করুন: ${profile.activeGroupName}` : `Use last: ${profile.activeGroupName}`}
                      </button>
                    )}
                  </div>
                </form>
              </section>
            </div>
          ) : (
            /* UNLOCKED GROUP TASKS LIST */
            <div className="space-y-5">
              {/* Group Status Strip + Interactive Filters */}
              <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-pink-50 text-pink-600 flex items-center justify-center shrink-0">
                    <Users className="w-5 h-5" />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 text-xs text-slate-500">
                      <span>{language === 'bn' ? 'অ্যাক্টিভ গ্রুপ' : 'Active Group'}</span>
                      <span aria-hidden="true">·</span>
                      <span className="font-mono">{tasks.length} {language === 'bn' ? 'টি টাস্ক' : 'Tasks'}</span>
                    </div>
                    <p className="font-display text-base font-bold text-slate-900">{unlockedGroup}</p>
                  </div>
                  <button
                    type="button"
                    onClick={handleLockOrSwitchGroup}
                    className="ml-1 px-3 py-1.5 rounded-lg border border-slate-200 hover:border-pink-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1.5 min-h-[36px]"
                  >
                    <RefreshCw className="w-3.5 h-3.5" />
                    <span>{tr('changeGroup')}</span>
                  </button>
                </div>

                {/* Interactive Filter Tabs */}
                <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-slate-100 rounded-xl">
                  {[
                    { id: 'all', label: language === 'bn' ? 'সব' : 'All' },
                    { id: 'available', label: language === 'bn' ? 'নতুন' : 'Available' },
                    { id: 'claimed', label: language === 'bn' ? 'নেওয়া' : 'Taken' },
                    { id: 'submitted', label: language === 'bn' ? 'রিভিউতে' : 'In Review' },
                    { id: 'approved', label: language === 'bn' ? 'কমপ্লিট' : 'Approved' },
                    { id: 'rejected', label: language === 'bn' ? 'রিজেক্ট' : 'Rejected' },
                  ].map((tab) => (
                    <button
                      key={tab.id}
                      type="button"
                      onClick={() => setFilter(tab.id as any)}
                      className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px] ${
                        filter === tab.id ? 'bg-white text-slate-900 shadow-xs' : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredTasks.length === 0 ? (
                <div className="bg-white rounded-2xl border border-slate-200 p-12 text-center space-y-3">
                  <p className="text-sm text-slate-600">
                    {language === 'bn'
                      ? `"${unlockedGroup}" গ্রুপে এই ফিল্টারে কোনো টাস্ক নেই।`
                      : `No tasks found under "${unlockedGroup}" for this filter.`}
                  </p>
                  <button
                    type="button"
                    onClick={handleLockOrSwitchGroup}
                    className="px-4 py-2 rounded-xl border border-slate-200 text-xs font-semibold text-slate-800 hover:bg-slate-50"
                  >
                    {tr('changeGroup')}
                  </button>
                </div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                  {filteredTasks.map((task) => {
                    const sub = subMap.get(task.id);
                    const effStatus = getEffectiveStatus(task);
                    const isAvailable = effStatus === 'available';
                    const canUploadProof = effStatus === 'available' || effStatus === 'claimed' || effStatus === 'rejected';

                    return (
                      <article
                        key={task.id}
                        className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-4 hover:border-pink-200 transition-colors"
                      >
                        <div className="space-y-3">
                          <div className="flex items-start justify-between gap-3">
                            <h2 className="font-display text-base font-bold text-slate-900 leading-snug">
                              {task.title}
                            </h2>
                            <span className="font-mono text-base font-bold text-pink-600 tabular-nums shrink-0">
                              +{formatCurrency(task.commission)}
                            </span>
                          </div>

                          {/* Clean Unboxed Metadata */}
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500">
                            <span className="font-medium text-slate-700">{actionLabel(task.taskType)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{task.groupName}</span>
                            <span aria-hidden="true">·</span>
                            <span>Due {task.deadline}</span>
                            <span aria-hidden="true">·</span>
                            <StatusText status={effStatus} />
                          </div>

                          {/* TikTok Username & Copy / Open controls (Revealed after Group unlock) */}
                          <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                            <span className="font-mono text-xs font-semibold text-navy-900 truncate">
                              {task.tiktokUsername}
                            </span>
                            <div className="flex items-center gap-1.5 shrink-0">
                              <button
                                type="button"
                                onClick={() => handleCopyUsername(task.id, task.tiktokUsername)}
                                className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-pink-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 min-h-[36px]"
                              >
                                {copiedId === task.id ? (
                                  <Check className="w-3.5 h-3.5 text-emerald-600" />
                                ) : (
                                  <Copy className="w-3.5 h-3.5" />
                                )}
                                <span>{copiedId === task.id ? tr('copied') : tr('copyUsername')}</span>
                              </button>
                              <a
                                href={task.tiktokUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="px-2.5 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold inline-flex items-center gap-1 min-h-[36px]"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                <span>Open</span>
                              </a>
                            </div>
                          </div>

                          <p className="text-xs sm:text-sm text-slate-600 leading-relaxed">{task.instructions}</p>

                          {sub?.status === 'rejected' && sub.rejectionReason && (
                            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                              <strong>{language === 'bn' ? 'বাতিলের কারণ:' : 'Rejection Reason:'}</strong> {sub.rejectionReason}
                            </div>
                          )}
                        </div>

                        <div className="pt-3 border-t border-slate-100">
                          {isAvailable ? (
                            <div className="grid grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={claimingId === task.id}
                                onClick={() => handleTakeProject(task)}
                                className="py-2.5 px-3 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px] disabled:opacity-60"
                              >
                                <Briefcase className="w-4 h-4 shrink-0" />
                                <span>{claimingId === task.id ? '...' : tr('takeProject')}</span>
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setModalTarget({ task });
                                  setProofPreview('');
                                  setNote('');
                                }}
                                className="py-2.5 px-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs sm:text-sm font-semibold flex items-center justify-center gap-1.5 transition-colors min-h-[44px]"
                              >
                                <Upload className="w-4 h-4 shrink-0" />
                                <span>{tr('submitTask')}</span>
                              </button>
                            </div>
                          ) : canUploadProof ? (
                            <div className="space-y-2">
                              <button
                                type="button"
                                onClick={() => {
                                  setModalTarget({ task, submission: sub });
                                  setProofPreview('');
                                  setNote(sub?.note || '');
                                }}
                                className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                              >
                                <Upload className="w-4 h-4" />
                                <span>
                                  {effStatus === 'rejected'
                                    ? language === 'bn'
                                      ? 'পুনরায় প্রমাণ জমা দিন'
                                      : 'Resubmit Proof'
                                    : tr('submitTask')}
                                </span>
                              </button>
                            </div>
                          ) : (
                            <div className="w-full py-2.5 px-4 rounded-xl bg-slate-100 text-slate-700 text-xs font-semibold text-center">
                              {effStatus === 'approved'
                                ? language === 'bn'
                                  ? 'কম্প্লিট হয়েছে · কমিশন যুক্ত'
                                  : 'Completed · Commission Credited'
                                : effStatus === 'expired'
                                ? language === 'bn'
                                  ? 'টাস্কের মেয়াদ শেষ'
                                  : 'Task Expired'
                                : language === 'bn'
                                ? 'প্রমাণ জমা হয়েছে · রিভিউ চলছে'
                                : 'Proof Submitted · Awaiting Review'}
                            </div>
                          )}
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </>
      )}

      {/* =================================================================== */}
      {/* TAB 2: MY TASKS (মাই টাস্ক - নেওয়া প্রজেক্ট ও কমপ্লিশন হিসাব)      */}
      {/* =================================================================== */}
      {activeTab === 'my-tasks' && (
        <div className="space-y-6">
          {/* 4-Column KPI Summary Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'মোট নেওয়া প্রজেক্ট' : 'Projects Taken'}
              </p>
              <p className="font-mono text-2xl font-bold text-slate-900 tabular-nums mt-1">
                {myStats.totalTaken}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'মোট কমপ্লিট হয়েছে' : 'Completed Tasks'}
              </p>
              <p className="font-mono text-2xl font-bold text-emerald-700 tabular-nums mt-1">
                {myStats.completed}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'চলমান / রিভিউতে' : 'Active & In Review'}
              </p>
              <p className="font-mono text-2xl font-bold text-amber-700 tabular-nums mt-1">
                {myStats.inProgress + myStats.inReview}
              </p>
            </div>
            <div className="bg-white rounded-2xl border border-slate-200 p-4 sm:p-5">
              <p className="text-xs text-slate-500">
                {language === 'bn' ? 'টাস্ক থেকে অর্জিত আয়' : 'Verified Earnings'}
              </p>
              <p className="font-mono text-2xl font-bold text-pink-600 tabular-nums mt-1">
                {formatCurrency(myStats.earned)}
              </p>
            </div>
          </div>

          {/* Group-wise Completion Accounting */}
          {myStats.groupSummary.length > 0 && (
            <section className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200 flex items-center justify-between">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    {language === 'bn' ? 'গ্রুপভিত্তিক কাজের ও পেমেন্ট হিসাব' : 'Group-Wise Project & Payout Summary'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {language === 'bn'
                      ? 'প্রতিটি গ্রুপে নেওয়া প্রজেক্ট ও কমপ্লিট সংখ্যার হিসাব'
                      : 'Projects taken and completed per Group Name for payout accounting.'}
                  </p>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500">
                      <th className="py-3 px-4">{tr('groupName')}</th>
                      <th className="py-3 px-4 text-right">{language === 'bn' ? 'নেওয়া' : 'Taken'}</th>
                      <th className="py-3 px-4 text-right">{language === 'bn' ? 'কমপ্লিট' : 'Completed'}</th>
                      <th className="py-3 px-4 text-right">{language === 'bn' ? 'আয়' : 'Earned'}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {myStats.groupSummary.map((row) => (
                      <tr key={row.group} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">{row.group}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-slate-700">{row.taken}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums font-bold text-emerald-700">
                          {row.completed}
                        </td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums font-bold text-pink-600">
                          {formatCurrency(row.earned)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}

          {/* Filter Toolbar for My Tasks */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">
              {language === 'bn' ? 'আপনার নেওয়া প্রজেক্ট সমূহ' : 'Claimed Like & Follow Projects'}
            </h2>
            <div className="inline-flex flex-wrap items-center gap-1 p-1 bg-white border border-slate-200 rounded-xl">
              {[
                { id: 'all', label: language === 'bn' ? 'সব' : 'All' },
                { id: 'claimed', label: language === 'bn' ? 'প্রমাণ বাকি' : 'In Progress' },
                { id: 'submitted', label: language === 'bn' ? 'রিভিউতে' : 'In Review' },
                { id: 'approved', label: language === 'bn' ? 'কমপ্লিট' : 'Completed' },
                { id: 'rejected', label: language === 'bn' ? 'রিজেক্ট' : 'Rejected' },
              ].map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setMyFilter(tab.id as any)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors whitespace-nowrap min-h-[36px] ${
                    myFilter === tab.id ? 'bg-navy-900 text-white' : 'text-slate-600 hover:text-slate-900'
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>

          {filteredMyTasks.length === 0 ? (
            <div className="bg-white rounded-2xl border border-slate-200 p-10 text-center space-y-3">
              <FolderCheck className="w-9 h-9 text-slate-400 mx-auto" />
              <p className="text-sm font-medium text-slate-700">
                {language === 'bn'
                  ? 'এখনো কোনো প্রজেক্ট নেওয়া হয়নি। টাস্ক ট্যাবে গিয়ে গ্রুপ নেম দিয়ে প্রজেক্ট নিন।'
                  : 'No projects claimed yet. Unlock your daily Group Name in Tasks to take a Like/Follow project.'}
              </p>
              <button
                type="button"
                onClick={() => switchMainTab('tasks')}
                className="px-5 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold inline-flex items-center gap-2 min-h-[42px]"
              >
                <span>{language === 'bn' ? 'টাস্ক ট্যাবে যান' : 'Go to Tasks'}</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
              {filteredMyTasks.map((sub) => {
                const parentTask = taskMap.get(sub.taskId);
                const tiktokUrl =
                  parentTask?.tiktokUrl ||
                  `https://www.tiktok.com/${sub.tiktokUsername.startsWith('@') ? sub.tiktokUsername : '@' + sub.tiktokUsername}`;
                const needsProof = sub.status === 'claimed' || sub.status === 'rejected';
                const step =
                  sub.status === 'approved' ? 3 : sub.status === 'submitted' || sub.status === 'under_review' ? 2 : 1;

                return (
                  <article
                    key={sub.id}
                    className="bg-white rounded-2xl border border-slate-200 p-5 sm:p-6 flex flex-col justify-between gap-4"
                  >
                    <div className="space-y-3">
                      <div className="flex items-start justify-between gap-3">
                        <div className="min-w-0">
                          <h3 className="font-display text-base font-bold text-slate-900 truncate">
                            {sub.taskTitle}
                          </h3>
                          <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 mt-1">
                            <span>{sub.groupName || 'Group Task'}</span>
                            <span aria-hidden="true">·</span>
                            <span className="font-mono">{formatDateTime(sub.updatedAt || sub.createdAt)}</span>
                            <span aria-hidden="true">·</span>
                            <StatusText status={sub.status} />
                          </div>
                        </div>
                        <span className="font-mono text-base font-bold text-pink-600 tabular-nums shrink-0">
                          +{formatCurrency(sub.commission)}
                        </span>
                      </div>

                      {/* 3-Step Visual Project Progress Rail */}
                      <div className="grid grid-cols-3 gap-2 pt-1 text-[11px] font-semibold">
                        <div className={`py-2 px-2.5 rounded-xl border ${step >= 1 ? 'bg-navy-900 text-white border-navy-900' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          1. {language === 'bn' ? 'নেওয়া হয়েছে' : 'Taken'}
                        </div>
                        <div className={`py-2 px-2.5 rounded-xl border ${step >= 2 ? 'bg-sky-700 text-white border-sky-700' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          2. {language === 'bn' ? 'প্রমাণ জমা' : 'Submitted'}
                        </div>
                        <div className={`py-2 px-2.5 rounded-xl border ${step >= 3 ? 'bg-emerald-600 text-white border-emerald-600' : 'bg-slate-50 text-slate-400 border-slate-200'}`}>
                          3. {language === 'bn' ? 'কম্প্লিট' : 'Completed'}
                        </div>
                      </div>

                      {/* TikTok Username & Quick Open */}
                      <div className="p-3 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between gap-2">
                        <span className="font-mono text-xs font-semibold text-navy-900 truncate">
                          {sub.tiktokUsername}
                        </span>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleCopyUsername(sub.id, sub.tiktokUsername)}
                            className="px-2.5 py-1.5 rounded-lg bg-white border border-slate-200 hover:border-pink-300 text-xs font-semibold text-slate-700 inline-flex items-center gap-1 min-h-[36px]"
                          >
                            {copiedId === sub.id ? (
                              <Check className="w-3.5 h-3.5 text-emerald-600" />
                            ) : (
                              <Copy className="w-3.5 h-3.5" />
                            )}
                            <span>{copiedId === sub.id ? tr('copied') : tr('copyUsername')}</span>
                          </button>
                          <a
                            href={tiktokUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="px-2.5 py-1.5 rounded-lg bg-navy-900 hover:bg-navy-800 text-white text-xs font-semibold inline-flex items-center gap-1 min-h-[36px]"
                          >
                            <ExternalLink className="w-3.5 h-3.5" />
                            <span>Open</span>
                          </a>
                        </div>
                      </div>

                      {sub.status === 'rejected' && sub.rejectionReason && (
                        <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 text-xs text-rose-800">
                          <strong>{language === 'bn' ? 'বাতিলের কারণ:' : 'Rejection Reason:'}</strong> {sub.rejectionReason}
                        </div>
                      )}
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between gap-3">
                      {needsProof ? (
                        <button
                          type="button"
                          onClick={() => {
                            setModalTarget({ task: parentTask, submission: sub });
                            setProofPreview('');
                            setNote(sub.note || '');
                          }}
                          className="w-full py-2.5 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 transition-colors min-h-[44px]"
                        >
                          <Upload className="w-4 h-4" />
                          <span>
                            {sub.status === 'rejected'
                              ? language === 'bn'
                                ? 'পুনরায় প্রমাণ আপলোড করুন'
                                : 'Resubmit Proof'
                              : language === 'bn'
                              ? 'স্ক্রিনশট প্রমাণ জমা দিন'
                              : 'Upload Proof Screenshot'}
                          </span>
                        </button>
                      ) : (
                        <>
                          <div className="text-xs font-semibold text-slate-600 flex items-center gap-1.5">
                            <CheckCircle2 className={`w-4 h-4 ${sub.status === 'approved' ? 'text-emerald-600' : 'text-sky-600'}`} />
                            <span>
                              {sub.status === 'approved'
                                ? language === 'bn'
                                  ? 'কমপ্লিট · কমিশন ওয়ালেটে যোগ হয়েছে'
                                  : 'Completed · Commission Credited'
                                : language === 'bn'
                                ? 'অ্যাডমিন রিভিউয়ের জন্য অপেক্ষমাণ'
                                : 'Waiting for Admin Review'}
                            </span>
                          </div>
                          {sub.proofImageData && (
                            <button
                              type="button"
                              onClick={() => setProofViewer({ url: sub.proofImageData, title: sub.taskTitle })}
                              className="px-3 py-1.5 rounded-lg border border-slate-200 hover:bg-slate-50 text-xs font-semibold text-slate-700 shrink-0"
                            >
                              {language === 'bn' ? 'প্রমাণ দেখুন' : 'View Proof'}
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Submit Proof Modal */}
      {modalTarget && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-lg w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">{modalTitle}</h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  {modalUsername} {modalGroup ? `· ${modalGroup}` : ''} · {tr('commission')} {formatCurrency(modalCommission)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setModalTarget(null)}
                className="min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg hover:bg-slate-100 text-slate-500"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSubmitTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-2">
                  {tr('uploadScreenshot')}
                </label>
                <label className="block border-2 border-dashed border-slate-200 hover:border-pink-400 rounded-2xl p-5 text-center cursor-pointer transition-colors">
                  {proofPreview ? (
                    <img
                      src={proofPreview}
                      alt="Proof preview"
                      className="max-h-56 mx-auto rounded-xl object-contain"
                    />
                  ) : (
                    <div className="space-y-2 py-4">
                      <ImagePlus className="w-8 h-8 text-pink-600 mx-auto" />
                      <p className="text-xs font-semibold text-slate-700">
                        {language === 'bn'
                          ? 'স্ক্রিনশট ছবি নির্বাচন করতে ক্লিক করুন (PNG / JPG)'
                          : 'Click to select screenshot image (PNG / JPG)'}
                      </p>
                    </div>
                  )}
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    className="hidden"
                  />
                </label>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  {language === 'bn'
                    ? 'আপনার টিকটক ইউজারনেম বা নোট (ঐচ্ছিক)'
                    : 'Optional Note (Your TikTok handle)'}
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="e.g. Completed from @my_handle"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
                />
              </div>

              <button
                type="submit"
                disabled={submitting || !proofPreview}
                className="w-full py-3 px-4 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold flex items-center justify-center gap-2 disabled:opacity-60 min-h-[44px]"
              >
                <Send className="w-4 h-4" />
                <span>{submitting ? (language === 'bn' ? 'জমা হচ্ছে...' : 'Submitting...') : tr('submitTask')}</span>
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Proof Image Lightbox Modal */}
      {proofViewer && (
        <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl max-w-xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900">{proofViewer.title}</h3>
              <button
                type="button"
                onClick={() => setProofViewer(null)}
                className="p-2 rounded-lg hover:bg-slate-100 text-slate-600"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={proofViewer.url}
              alt={proofViewer.title}
              className="max-h-[70vh] w-full object-contain rounded-xl bg-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
