import React, { useEffect, useState } from 'react';
import { collection, onSnapshot } from 'firebase/firestore';
import {
  ArrowDownLeft,
  ArrowUpRight,
  CreditCard,
  Database,
  Globe,
  LayoutDashboard,
  ListChecks,
  Shield,
  ShoppingBag,
  Users,
  Wallet as WalletIcon,
  X,
} from 'lucide-react';
import { db } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import { adminSeedInitialData } from '@/src/lib/firestoreService';
import { formatCurrency } from '@/src/lib/imageUtils';
import {
  AdminRole,
  AuditLog,
  DepositRequest,
  MarketplaceListing,
  MarketplaceOrder,
  TaskSubmission,
  TikTokTask,
  TransactionRecord,
  UserProfile,
  Wallet,
  WithdrawalRequest,
} from '@/src/types';
import { AdminOperationsTab } from '@/src/pages/admin/AdminOperationsTab';
import { AdminConfigTab } from '@/src/pages/admin/AdminConfigTab';

type SectionKey =
  | 'overview'
  | 'users'
  | 'tasks'
  | 'deposits'
  | 'withdrawals'
  | 'wallets'
  | 'website'
  | 'payments'
  | 'marketplace'
  | 'adminSettings';

export function AdminPage() {
  const { firebaseUser, isAdmin, showToast } = useApp();
  const [section, setSection] = useState<SectionKey>('overview');

  const [users, setUsers] = useState<UserProfile[]>([]);
  const [wallets, setWallets] = useState<Wallet[]>([]);
  const [tasks, setTasks] = useState<TikTokTask[]>([]);
  const [submissions, setSubmissions] = useState<TaskSubmission[]>([]);
  const [deposits, setDeposits] = useState<DepositRequest[]>([]);
  const [withdrawals, setWithdrawals] = useState<WithdrawalRequest[]>([]);
  const [transactions, setTransactions] = useState<TransactionRecord[]>([]);
  const [listings, setListings] = useState<MarketplaceListing[]>([]);
  const [orders, setOrders] = useState<MarketplaceOrder[]>([]);
  const [adminRoles, setAdminRoles] = useState<AdminRole[]>([]);
  const [auditLogs, setAuditLogs] = useState<AuditLog[]>([]);
  const [seeding, setSeeding] = useState(false);

  const [previewModal, setPreviewModal] = useState<{ url: string; title: string } | null>(null);

  useEffect(() => {
    if (!isAdmin) return;

    const sortByTime = <T extends { createdAt?: any }>(arr: T[]) =>
      arr.sort((a, b) => (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0));

    const unsubs = [
      onSnapshot(collection(db, 'users'), (s) => setUsers(sortByTime(s.docs.map((d) => d.data() as UserProfile))), () => {}),
      onSnapshot(collection(db, 'wallets'), (s) => setWallets(s.docs.map((d) => d.data() as Wallet)), () => {}),
      onSnapshot(collection(db, 'tasks'), (s) => setTasks(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as TikTokTask)))), () => {}),
      onSnapshot(collection(db, 'taskSubmissions'), (s) => setSubmissions(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as TaskSubmission)))), () => {}),
      onSnapshot(collection(db, 'deposits'), (s) => setDeposits(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as DepositRequest)))), () => {}),
      onSnapshot(collection(db, 'withdrawals'), (s) => setWithdrawals(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as WithdrawalRequest)))), () => {}),
      onSnapshot(collection(db, 'transactions'), (s) => setTransactions(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as TransactionRecord)))), () => {}),
      onSnapshot(collection(db, 'marketplaceListings'), (s) => setListings(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as MarketplaceListing)))), () => {}),
      onSnapshot(collection(db, 'marketplaceOrders'), (s) => setOrders(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as MarketplaceOrder)))), () => {}),
      onSnapshot(collection(db, 'admins'), (s) => setAdminRoles(s.docs.map((d) => d.data() as AdminRole)), () => {}),
      onSnapshot(collection(db, 'auditLogs'), (s) => setAuditLogs(sortByTime(s.docs.map((d) => ({ id: d.id, ...d.data() } as AuditLog)))), () => {}),
    ];

    return () => unsubs.forEach((u) => u());
  }, [isAdmin]);

  if (!isAdmin) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 p-8 sm:p-10 text-center max-w-lg mx-auto my-8 space-y-3">
        <Shield className="w-10 h-10 text-rose-600 mx-auto" />
        <h1 className="font-display text-xl font-bold text-slate-900">Admin Authorization Required</h1>
        <p className="text-sm text-slate-600">
          Sign in with the verified administrator Google/Email account (<span className="font-mono font-semibold text-slate-900">smmservicehelpcentre@gmail.com</span>) or an assigned admin role to access platform controls.
        </p>
        {firebaseUser?.email && (
          <p className="text-xs text-slate-500 font-mono">
            Signed in as: {firebaseUser.email}
          </p>
        )}
      </div>
    );
  }

  const activeUsers = users.filter((u) => u.status === 'active').length;
  const pendingUsers = users.filter((u) => u.status === 'pending').length;
  const approvedDepositsTotal = deposits.filter((d) => d.status === 'approved').reduce((acc, d) => acc + d.amount, 0);
  const pendingDepositsCount = deposits.filter((d) => d.status === 'pending').length;
  const paidWithdrawalsTotal = withdrawals.filter((w) => w.status === 'paid').reduce((acc, w) => acc + w.amount, 0);
  const pendingWithdrawalsCount = withdrawals.filter((w) => ['pending', 'processing', 'approved'].includes(w.status)).length;
  const pendingTaskReviews = submissions.filter((s) => s.status === 'submitted' || s.status === 'under_review').length;
  const totalCommissionPaid = submissions.filter((s) => s.commissionPaid).reduce((acc, s) => acc + s.commission, 0);

  const navLinks: { id: SectionKey; label: string; icon: any; badge?: number }[] = [
    { id: 'overview', label: 'Overview', icon: LayoutDashboard },
    { id: 'users', label: 'User Management', icon: Users },
    { id: 'tasks', label: 'Task Management', icon: ListChecks, badge: pendingTaskReviews },
    { id: 'deposits', label: 'Deposit Requests', icon: ArrowDownLeft, badge: pendingDepositsCount },
    { id: 'withdrawals', label: 'Withdrawals', icon: ArrowUpRight, badge: pendingWithdrawalsCount },
    { id: 'wallets', label: 'Wallet Ledger', icon: WalletIcon },
    { id: 'website', label: 'Website Settings', icon: Globe },
    { id: 'payments', label: 'Payment Settings', icon: CreditCard },
    { id: 'marketplace', label: 'Marketplace', icon: ShoppingBag },
    { id: 'adminSettings', label: 'Admin & Audit Logs', icon: Shield },
  ];

  const handleSeed = async () => {
    if (!firebaseUser) return;
    setSeeding(true);
    try {
      await adminSeedInitialData(firebaseUser.uid, firebaseUser.email || '');
      showToast('Default settings, sample tasks, and catalog seeded!', 'success');
    } catch (err: any) {
      showToast(err?.message || 'Seeding failed.', 'error');
    } finally {
      setSeeding(false);
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
      {/* Sidebar Nav */}
      <aside className="lg:col-span-3 bg-white rounded-2xl border border-slate-200 p-3 lg:sticky lg:top-20">
        <div className="px-3 py-2 mb-1">
          <p className="font-display text-sm font-bold text-navy-900">Admin Console</p>
          <p className="text-[11px] text-slate-500 font-mono truncate">{firebaseUser?.email}</p>
        </div>
        <div className="flex lg:flex-col gap-1 overflow-x-auto pb-1 lg:pb-0">
          {navLinks.map((item) => {
            const Icon = item.icon;
            const active = section === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setSection(item.id)}
                className={`flex items-center justify-between gap-2 px-3 py-2.5 rounded-xl text-xs sm:text-sm font-semibold transition-colors whitespace-nowrap shrink-0 min-h-[42px] ${
                  active ? 'bg-navy-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
                }`}
              >
                <span className="inline-flex items-center gap-2.5">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{item.label}</span>
                </span>
                {item.badge ? (
                  <span className={`font-mono text-[11px] px-1.5 py-0.5 rounded-md ${active ? 'bg-pink-600 text-white' : 'bg-pink-50 text-pink-700'}`}>
                    {item.badge}
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      </aside>

      {/* Main Content */}
      <div className="lg:col-span-9 space-y-6">
        {section === 'overview' && (
          <div className="space-y-6">
            <div className="bg-navy-900 text-white rounded-2xl p-6 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div>
                <h1 className="font-display text-2xl font-bold">Platform Operations Overview</h1>
                <p className="text-xs sm:text-sm text-slate-300 mt-1">
                  Real-time Firestore metrics across users, task payouts, deposits, withdrawals, and marketplace escrow.
                </p>
              </div>
              <button
                type="button"
                disabled={seeding}
                onClick={handleSeed}
                className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-xs font-semibold inline-flex items-center gap-2 shrink-0 min-h-[42px]"
              >
                <Database className="w-4 h-4" />
                <span>{seeding ? 'Initializing...' : 'Initialize Starter Data'}</span>
              </button>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4">
              {[
                { label: 'Total Users', val: users.length },
                { label: 'Active Users', val: activeUsers },
                { label: 'Pending Users', val: pendingUsers },
                { label: 'Pending Deposits', val: pendingDepositsCount, accent: 'text-amber-700' },
                { label: 'Pending Withdrawals', val: pendingWithdrawalsCount, accent: 'text-amber-700' },
                { label: 'Total Deposits', val: formatCurrency(approvedDepositsTotal), accent: 'text-emerald-700' },
                { label: 'Total Withdrawals', val: formatCurrency(paidWithdrawalsTotal) },
                { label: 'Task Submissions', val: submissions.length },
                { label: 'Pending Reviews', val: pendingTaskReviews, accent: 'text-pink-600' },
                { label: 'Commission Paid', val: formatCurrency(totalCommissionPaid), accent: 'text-pink-600' },
              ].map((kpi) => (
                <div key={kpi.label} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <p className="text-xs text-slate-500">{kpi.label}</p>
                  <p className={`font-mono text-xl font-bold tabular-nums mt-1.5 ${kpi.accent || 'text-slate-900'}`}>
                    {kpi.val}
                  </p>
                </div>
              ))}
            </div>
          </div>
        )}

        {['users', 'tasks', 'deposits', 'withdrawals', 'wallets'].includes(section) && (
          <AdminOperationsTab
            activeSection={section as any}
            users={users}
            wallets={wallets}
            tasks={tasks}
            submissions={submissions}
            deposits={deposits}
            withdrawals={withdrawals}
            transactions={transactions}
            onPreviewImage={(url, title) => setPreviewModal({ url, title })}
          />
        )}

        {['website', 'payments', 'marketplace', 'adminSettings'].includes(section) && (
          <AdminConfigTab
            activeSection={section as any}
            listings={listings}
            orders={orders}
            adminRoles={adminRoles}
            auditLogs={auditLogs}
            onPreviewImage={(url, title) => setPreviewModal({ url, title })}
          />
        )}
      </div>

      {/* Screenshot Preview Lightbox */}
      {previewModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-5 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="font-display text-base font-bold text-slate-900 truncate">{previewModal.title}</h3>
              <button type="button" onClick={() => setPreviewModal(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <img
              src={previewModal.url}
              alt={previewModal.title}
              className="w-full max-h-[70vh] object-contain rounded-xl bg-slate-50 border border-slate-100"
            />
          </div>
        </div>
      )}
    </div>
  );
}
