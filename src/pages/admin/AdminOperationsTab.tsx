import React, { useState } from 'react';
import { sendPasswordResetEmail } from 'firebase/auth';
import {
  CheckCircle2,
  Edit3,
  Eye,
  KeyRound,
  Plus,
  Search,
  Trash2,
  UserCheck,
  UserX,
  Wallet as WalletIcon,
  X,
  XCircle,
} from 'lucide-react';
import { auth } from '@/src/lib/firebase';
import { useApp } from '@/src/context/AppContext';
import {
  adminDeleteTask,
  adminManualWalletAdjustment,
  adminReviewDeposit,
  adminReviewTaskSubmission,
  adminSaveTask,
  adminUpdateUserAccount,
  adminUpdateWithdrawal,
} from '@/src/lib/firestoreService';
import { formatCurrency, formatDateTime } from '@/src/lib/imageUtils';
import {
  DepositRequest,
  TaskStatus,
  TaskSubmission,
  TaskType,
  TikTokTask,
  TransactionRecord,
  UserProfile,
  UserStatus,
  Wallet,
  WithdrawalRequest,
  WithdrawalStatus,
} from '@/src/types';
import { StatusText } from '@/src/components/StatusText';

interface Props {
  activeSection: 'users' | 'tasks' | 'deposits' | 'withdrawals' | 'wallets';
  users: UserProfile[];
  wallets: Wallet[];
  tasks: TikTokTask[];
  submissions: TaskSubmission[];
  deposits: DepositRequest[];
  withdrawals: WithdrawalRequest[];
  transactions: TransactionRecord[];
  onPreviewImage: (url: string, title: string) => void;
}

export function AdminOperationsTab({
  activeSection,
  users,
  wallets,
  tasks,
  submissions,
  deposits,
  withdrawals,
  transactions,
  onPreviewImage,
}: Props) {
  const { firebaseUser, showToast } = useApp();

  // Users state
  const [userSearch, setUserSearch] = useState('');
  const [inspectUser, setInspectUser] = useState<UserProfile | null>(null);
  const [editingUser, setEditingUser] = useState<UserProfile | null>(null);
  const [editUserForm, setEditUserForm] = useState({ fullName: '', username: '', mobile: '', status: 'active' as UserStatus });

  // Tasks state
  const [taskModalOpen, setTaskModalOpen] = useState(false);
  const [editingTaskId, setEditingTaskId] = useState<string | undefined>(undefined);
  const [groupFilter, setGroupFilter] = useState<string>('ALL');
  const [taskForm, setTaskForm] = useState({
    title: '',
    groupName: '',
    tiktokUsername: '',
    tiktokUrl: 'https://www.tiktok.com/@',
    instructions: '',
    taskType: 'like_follow' as TaskType,
    commission: '20',
    startDate: new Date().toISOString().slice(0, 10),
    deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
    status: 'active' as TaskStatus,
    assignMode: 'all' as 'all' | 'specific',
    assignedUserIds: [] as string[],
  });

  // Rejection / Admin note prompt modal
  const [rejectModal, setRejectModal] = useState<{
    kind: 'task' | 'deposit' | 'withdrawal';
    id: string;
    nextStatus?: WithdrawalStatus;
  } | null>(null);
  const [reasonText, setReasonText] = useState('');

  // Wallet manual adjustment
  const [adjustUserId, setAdjustUserId] = useState('');
  const [adjustMode, setAdjustMode] = useState<'credit' | 'debit'>('credit');
  const [adjustAmount, setAdjustAmount] = useState('');
  const [adjustReason, setAdjustReason] = useState('');
  const [busy, setBusy] = useState(false);

  const walletMap = new Map(wallets.map((w) => [w.userId, w]));
  const adminUid = firebaseUser?.uid || '';
  const adminEmail = firebaseUser?.email || '';

  const filteredUsers = users.filter((u) => {
    const q = userSearch.toLowerCase();
    return (
      !q ||
      u.fullName.toLowerCase().includes(q) ||
      u.username.toLowerCase().includes(q) ||
      u.email.toLowerCase().includes(q) ||
      u.uid.toLowerCase().includes(q)
    );
  });

  const handleSaveUserEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingUser) return;
    setBusy(true);
    try {
      await adminUpdateUserAccount({
        targetUid: editingUser.uid,
        updates: editUserForm,
        adminUid,
        adminEmail,
      });
      showToast('User account updated.', 'success');
      setEditingUser(null);
    } catch (err: any) {
      showToast(err?.message || 'Update failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleQuickUserStatus = async (u: UserProfile, status: UserStatus) => {
    try {
      await adminUpdateUserAccount({
        targetUid: u.uid,
        updates: { status },
        adminUid,
        adminEmail,
      });
      showToast(`User ${u.username} set to ${status}.`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Failed.', 'error');
    }
  };

  const handleResetUserPassword = async (email: string) => {
    try {
      await sendPasswordResetEmail(auth, email);
      showToast(`Password reset email sent to ${email}`, 'success');
    } catch (err: any) {
      showToast(err?.message || 'Could not send reset email.', 'error');
    }
  };

  const openCreateTask = () => {
    setEditingTaskId(undefined);
    setTaskForm({
      title: '',
      groupName: groupFilter !== 'ALL' ? groupFilter : '',
      tiktokUsername: '@',
      tiktokUrl: 'https://www.tiktok.com/@',
      instructions: '',
      taskType: 'like_follow',
      commission: '20',
      startDate: new Date().toISOString().slice(0, 10),
      deadline: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10),
      status: 'active',
      assignMode: 'all',
      assignedUserIds: [],
    });
    setTaskModalOpen(true);
  };

  const openEditTask = (t: TikTokTask) => {
    setEditingTaskId(t.id);
    setTaskForm({
      title: t.title,
      groupName: t.groupName || '',
      tiktokUsername: t.tiktokUsername,
      tiktokUrl: t.tiktokUrl,
      instructions: t.instructions,
      taskType: t.taskType,
      commission: String(t.commission),
      startDate: t.startDate,
      deadline: t.deadline,
      status: t.status,
      assignMode: t.assignMode,
      assignedUserIds: t.assignedUserIds || [],
    });
    setTaskModalOpen(true);
  };

  const handleSaveTask = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await adminSaveTask({
        taskId: editingTaskId,
        ...taskForm,
        commission: Number(taskForm.commission),
        adminUid,
        adminEmail,
      });
      showToast(editingTaskId ? 'Task updated.' : 'Task created and assigned!', 'success');
      setTaskModalOpen(false);
    } catch (err: any) {
      showToast(err?.message || 'Could not save task.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmRejectOrNote = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rejectModal) return;
    setBusy(true);
    try {
      if (rejectModal.kind === 'task') {
        await adminReviewTaskSubmission({
          submissionId: rejectModal.id,
          action: 'rejected',
          rejectionReason: reasonText || 'Proof unclear',
          adminUid,
          adminEmail,
        });
      } else if (rejectModal.kind === 'deposit') {
        await adminReviewDeposit({
          depositId: rejectModal.id,
          decision: 'rejected',
          rejectionReason: reasonText || 'Invalid transaction ID',
          adminUid,
          adminEmail,
        });
      } else if (rejectModal.kind === 'withdrawal' && rejectModal.nextStatus) {
        await adminUpdateWithdrawal({
          withdrawalId: rejectModal.id,
          nextStatus: rejectModal.nextStatus,
          adminNote: reasonText,
          adminUid,
          adminEmail,
        });
      }
      showToast('Action completed.', 'success');
      setRejectModal(null);
      setReasonText('');
    } catch (err: any) {
      showToast(err?.message || 'Action failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  const handleManualAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustUserId) {
      showToast('Select a user first.', 'error');
      return;
    }
    setBusy(true);
    try {
      await adminManualWalletAdjustment({
        targetUserId: adjustUserId,
        mode: adjustMode,
        amount: Number(adjustAmount),
        reason: adjustReason,
        adminUid,
        adminEmail,
      });
      showToast('Wallet adjusted and logged to audit trail.', 'success');
      setAdjustAmount('');
      setAdjustReason('');
    } catch (err: any) {
      showToast(err?.message || 'Adjustment failed.', 'error');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      {/* 1. USER MANAGEMENT */}
      {activeSection === 'users' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="font-display text-lg font-bold text-slate-900">User Management ({users.length})</h2>
            <div className="relative w-full sm:w-72">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={userSearch}
                onChange={(e) => setUserSearch(e.target.value)}
                placeholder="Search name, email, username..."
                className="w-full pl-9 pr-3 py-2 rounded-xl border border-slate-200 text-sm focus:outline-none focus:border-pink-600"
              />
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse text-sm">
              <thead>
                <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                  <th className="py-3 px-4">User</th>
                  <th className="py-3 px-4">Group</th>
                  <th className="py-3 px-4">Mobile</th>
                  <th className="py-3 px-4">Balance</th>
                  <th className="py-3 px-4">Status</th>
                  <th className="py-3 px-4 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredUsers.map((u) => {
                  const w = walletMap.get(u.uid);
                  return (
                    <tr key={u.uid} className="hover:bg-slate-50/70">
                      <td className="py-3 px-4">
                        <p className="font-semibold text-slate-900">{u.fullName}</p>
                        <p className="text-xs text-slate-500 font-mono">
                          @{u.username} · {u.email}
                        </p>
                      </td>
                      <td className="py-3 px-4 font-mono text-xs font-semibold text-pink-600">
                        {u.activeGroupName || '—'}
                      </td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-700">{u.mobile || '—'}</td>
                      <td className="py-3 px-4 font-mono font-bold text-slate-900 tabular-nums">
                        {formatCurrency(w?.availableBalance)}
                      </td>
                      <td className="py-3 px-4">
                        <StatusText status={u.status} />
                      </td>
                      <td className="py-3 px-4">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            onClick={() => setInspectUser(u)}
                            title="Inspect History"
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            <Eye className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingUser(u);
                              setEditUserForm({
                                fullName: u.fullName,
                                username: u.username,
                                mobile: u.mobile || '',
                                status: u.status,
                              });
                            }}
                            title="Edit User"
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            <Edit3 className="w-4 h-4" />
                          </button>
                          <button
                            type="button"
                            onClick={() => handleResetUserPassword(u.email)}
                            title="Send Password Reset"
                            className="p-2 rounded-lg border border-slate-200 hover:bg-slate-100 text-slate-700"
                          >
                            <KeyRound className="w-4 h-4" />
                          </button>
                          {u.status === 'blocked' ? (
                            <button
                              type="button"
                              onClick={() => handleQuickUserStatus(u, 'active')}
                              title="Unblock & Activate"
                              className="p-2 rounded-lg bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            >
                              <UserCheck className="w-4 h-4" />
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleQuickUserStatus(u, 'blocked')}
                              title="Block User"
                              className="p-2 rounded-lg bg-rose-50 text-rose-700 hover:bg-rose-100"
                            >
                              <UserX className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* 2. TASK MANAGEMENT */}
      {activeSection === 'tasks' && (() => {
        const groupStatsMap = new Map<string, { group: string; taskCount: number; claimed: number; submitted: number; approved: number; paidTotal: number }>();
        tasks.forEach((t) => {
          const g = t.groupName || 'Unassigned';
          const cur = groupStatsMap.get(g) || { group: g, taskCount: 0, claimed: 0, submitted: 0, approved: 0, paidTotal: 0 };
          cur.taskCount += 1;
          groupStatsMap.set(g, cur);
        });
        submissions.forEach((s) => {
          const g = s.groupName || 'Unassigned';
          const cur = groupStatsMap.get(g) || { group: g, taskCount: 0, claimed: 0, submitted: 0, approved: 0, paidTotal: 0 };
          if (s.status === 'claimed') cur.claimed += 1;
          if (s.status === 'submitted' || s.status === 'under_review') cur.submitted += 1;
          if (s.status === 'approved') cur.approved += 1;
          if (s.commissionPaid) cur.paidTotal += s.commission;
          groupStatsMap.set(g, cur);
        });
        const groupRows = Array.from(groupStatsMap.values());
        const visibleTasks = groupFilter === 'ALL' ? tasks : tasks.filter((t) => (t.groupName || 'Unassigned') === groupFilter);
        const visibleSubs = groupFilter === 'ALL' ? submissions : submissions.filter((s) => (s.groupName || 'Unassigned') === groupFilter);

        return (
        <div className="space-y-6">
          <div className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h2 className="font-display text-lg font-bold text-slate-900">Group TikTok Tasks ({tasks.length})</h2>
              <p className="text-xs text-slate-500">
                Assign a Group Name to each task. Workers must enter that Group Name to see the TikTok username and claim it.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2.5">
              <select
                value={groupFilter}
                onChange={(e) => setGroupFilter(e.target.value)}
                className="px-3 py-2.5 rounded-xl border border-slate-200 text-xs font-semibold bg-white min-h-[44px]"
              >
                <option value="ALL">All Groups ({tasks.length})</option>
                {groupRows.map((g) => (
                  <option key={g.group} value={g.group}>
                    Group: {g.group} ({g.taskCount})
                  </option>
                ))}
              </select>
              <button
                type="button"
                onClick={openCreateTask}
                className="px-4 py-2.5 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold inline-flex items-center gap-2 min-h-[44px]"
              >
                <Plus className="w-4 h-4" />
                <span>Create Group Task</span>
              </button>
            </div>
          </div>

          {/* Group Payment & Completion Accounting Table */}
          {groupRows.length > 0 && (
            <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
              <div className="p-4 sm:p-5 border-b border-slate-200">
                <h3 className="font-display text-base font-bold text-slate-900">
                  Group Payment &amp; Completion Accounting
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Track projects taken, pending proof reviews, completed count, and total commission paid per Group Name.
                </p>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse text-sm">
                  <thead>
                    <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                      <th className="py-3 px-4">Group Name</th>
                      <th className="py-3 px-4 text-right">Tasks</th>
                      <th className="py-3 px-4 text-right">In Progress</th>
                      <th className="py-3 px-4 text-right">In Review</th>
                      <th className="py-3 px-4 text-right">Completed</th>
                      <th className="py-3 px-4 text-right">Total Paid</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {groupRows.map((row) => (
                      <tr key={row.group} className="hover:bg-slate-50/70">
                        <td className="py-3 px-4 font-semibold text-slate-900">{row.group}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums">{row.taskCount}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-amber-700">{row.claimed}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums text-sky-700">{row.submitted}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums font-bold text-emerald-700">{row.approved}</td>
                        <td className="py-3 px-4 font-mono text-right tabular-nums font-bold text-pink-600">{formatCurrency(row.paidTotal)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {visibleTasks.map((t) => (
              <div key={t.id} className="bg-white rounded-2xl border border-slate-200 p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="flex items-start justify-between gap-3">
                    <div>
                      <p className="text-xs font-mono font-semibold text-pink-600 mb-0.5">
                        Group: {t.groupName || 'Unassigned'}
                      </p>
                      <h3 className="font-display text-base font-bold text-slate-900">{t.title}</h3>
                      <p className="text-xs font-mono text-slate-500">
                        {t.tiktokUsername} · {t.assignMode === 'all' ? 'All Group Members' : `${t.assignedUserIds.length} Users`} · Due {t.deadline}
                      </p>
                    </div>
                    <span className="font-mono text-base font-bold text-pink-600 tabular-nums">
                      {formatCurrency(t.commission)}
                    </span>
                  </div>
                  <p className="text-xs text-slate-600 mt-2 line-clamp-2">{t.instructions}</p>
                </div>
                <div className="flex items-center justify-between pt-3 border-t border-slate-100">
                  <StatusText status={t.status} />
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => openEditTask(t)}
                      className="px-3 py-1.5 rounded-lg border border-slate-200 text-xs font-semibold text-slate-700 hover:bg-slate-50"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      onClick={() => adminDeleteTask(t.id).then(() => showToast('Task deleted', 'info'))}
                      className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* Task Submissions Review Queue */}
          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                Task Proof Submissions ({visibleSubs.length})
              </h3>
            </div>
            <div className="divide-y divide-slate-100">
              {visibleSubs.length === 0 ? (
                <p className="p-8 text-center text-sm text-slate-500">No submissions yet.</p>
              ) : (
                visibleSubs.map((sub) => (
                  <div key={sub.id} className="p-4 sm:p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                    <div className="space-y-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <p className="text-sm font-bold text-slate-900">{sub.taskTitle}</p>
                        {sub.groupName && (
                          <span className="text-xs font-mono font-semibold text-pink-600">
                            · {sub.groupName}
                          </span>
                        )}
                        <StatusText status={sub.status} />
                      </div>
                      <p className="text-xs text-slate-600">
                        User: <span className="font-semibold">{sub.userName}</span> ({sub.userEmail}) · TikTok{' '}
                        <span className="font-mono">{sub.tiktokUsername}</span> · Commission{' '}
                        <span className="font-mono font-bold text-pink-600">{formatCurrency(sub.commission)}</span>
                      </p>
                      {sub.note && <p className="text-xs text-slate-500">Note: {sub.note}</p>}
                    </div>

                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      {sub.proofImageData && (
                        <button
                          type="button"
                          onClick={() => onPreviewImage(sub.proofImageData, `Proof: ${sub.taskTitle} (${sub.userName})`)}
                          className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                        >
                          <Eye className="w-3.5 h-3.5" />
                          <span>View Proof</span>
                        </button>
                      )}

                      {!sub.commissionPaid && sub.status !== 'approved' && sub.status !== 'claimed' && (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              adminReviewTaskSubmission({
                                submissionId: sub.id,
                                action: 'approved',
                                adminUid,
                                adminEmail,
                              })
                                .then(() => showToast('Approved & commission credited!', 'success'))
                                .catch((e) => showToast(e.message, 'error'))
                            }
                            className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <CheckCircle2 className="w-3.5 h-3.5" />
                            <span>Approve &amp; Pay</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              setReasonText('');
                              setRejectModal({ kind: 'task', id: sub.id });
                            }}
                            className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold inline-flex items-center gap-1.5"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            <span>Reject</span>
                          </button>
                        </>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
        );
      })()}

      {/* 3. DEPOSIT MANAGEMENT */}
      {activeSection === 'deposits' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-display text-lg font-bold text-slate-900">Deposit Verification ({deposits.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {deposits.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No deposit requests found.</p>
            ) : (
              deposits.map((dep) => (
                <div key={dep.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex items-center gap-3">
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(dep.amount)}
                      </span>
                      <span className="text-xs font-bold uppercase text-pink-600">{dep.method}</span>
                      <StatusText status={dep.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {dep.userName} ({dep.userEmail}) · Sender: <span className="font-mono">{dep.senderNumber}</span> · TrxID:{' '}
                      <span className="font-mono font-semibold text-slate-900">{dep.transactionId}</span>
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">{formatDateTime(dep.createdAt)}</p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2 shrink-0">
                    <button
                      type="button"
                      onClick={() => onPreviewImage(dep.proofImageData, `Deposit TrxID: ${dep.transactionId}`)}
                      className="px-3 py-2 rounded-xl border border-slate-200 hover:bg-slate-50 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Eye className="w-3.5 h-3.5" />
                      <span>Screenshot</span>
                    </button>
                    {dep.status === 'pending' && (
                      <>
                        <button
                          type="button"
                          onClick={() =>
                            adminReviewDeposit({
                              depositId: dep.id,
                              decision: 'approved',
                              adminUid,
                              adminEmail,
                            })
                              .then(() => showToast('Deposit approved & credited!', 'success'))
                              .catch((e) => showToast(e.message, 'error'))
                          }
                          className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                        >
                          Approve
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            setReasonText('');
                            setRejectModal({ kind: 'deposit', id: dep.id });
                          }}
                          className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
                        >
                          Reject
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 4. WITHDRAWAL MANAGEMENT */}
      {activeSection === 'withdrawals' && (
        <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
          <div className="p-5 border-b border-slate-200">
            <h2 className="font-display text-lg font-bold text-slate-900">Withdrawal Queue ({withdrawals.length})</h2>
          </div>
          <div className="divide-y divide-slate-100">
            {withdrawals.length === 0 ? (
              <p className="p-10 text-center text-sm text-slate-500">No withdrawal requests found.</p>
            ) : (
              withdrawals.map((wd) => (
                <div key={wd.id} className="p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                  <div className="space-y-1">
                    <div className="flex flex-wrap items-center gap-3">
                      <span className="font-mono text-base font-bold text-slate-900 tabular-nums">
                        {formatCurrency(wd.amount)}
                      </span>
                      <span className="text-xs font-mono text-pink-600 font-semibold">
                        Net Pay: {formatCurrency(wd.netAmount)}
                      </span>
                      <StatusText status={wd.status} />
                    </div>
                    <p className="text-xs text-slate-600">
                      {wd.userName} · {wd.method.replace('_', ' ').toUpperCase()}:{' '}
                      <span className="font-mono font-semibold text-slate-900">{wd.accountNumber}</span>
                    </p>
                    <p className="text-[11px] font-mono text-slate-400">{formatDateTime(wd.createdAt)}</p>
                  </div>

                  {wd.status !== 'paid' && wd.status !== 'rejected' && (
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() =>
                          adminUpdateWithdrawal({
                            withdrawalId: wd.id,
                            nextStatus: 'processing',
                            adminUid,
                            adminEmail,
                          }).then(() => showToast('Marked Processing', 'info'))
                        }
                        className="px-3 py-2 rounded-xl border border-slate-200 text-xs font-semibold hover:bg-slate-50"
                      >
                        Processing
                      </button>
                      <button
                        type="button"
                        onClick={() =>
                          adminUpdateWithdrawal({
                            withdrawalId: wd.id,
                            nextStatus: 'approved',
                            adminUid,
                            adminEmail,
                          }).then(() => showToast('Approved for payout', 'info'))
                        }
                        className="px-3 py-2 rounded-xl border border-sky-200 bg-sky-50 text-sky-700 text-xs font-semibold"
                      >
                        Approve
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReasonText('Payment dispatched');
                          setRejectModal({ kind: 'withdrawal', id: wd.id, nextStatus: 'paid' });
                        }}
                        className="px-3 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold"
                      >
                        Mark Paid
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setReasonText('');
                          setRejectModal({ kind: 'withdrawal', id: wd.id, nextStatus: 'rejected' });
                        }}
                        className="px-3 py-2 rounded-xl bg-rose-50 hover:bg-rose-100 text-rose-700 text-xs font-semibold"
                      >
                        Reject &amp; Refund
                      </button>
                    </div>
                  )}
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* 5. WALLET MANAGEMENT */}
      {activeSection === 'wallets' && (
        <div className="space-y-6">
          <form onSubmit={handleManualAdjustment} className="bg-white rounded-2xl border border-slate-200 p-6 space-y-4">
            <h2 className="font-display text-lg font-bold text-slate-900 flex items-center gap-2">
              <WalletIcon className="w-5 h-5 text-pink-600" />
              <span>Manual Balance Adjustment (Logged to Audit Trail)</span>
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Select User</label>
                <select
                  required
                  value={adjustUserId}
                  onChange={(e) => setAdjustUserId(e.target.value)}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="">Choose user...</option>
                  {users.map((u) => (
                    <option key={u.uid} value={u.uid}>
                      {u.fullName} (@{u.username}) — {formatCurrency(walletMap.get(u.uid)?.availableBalance)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Action</label>
                <select
                  value={adjustMode}
                  onChange={(e) => setAdjustMode(e.target.value as 'credit' | 'debit')}
                  className="w-full px-3 py-2.5 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="credit">Credit (+ Add Funds)</option>
                  <option value="debit">Debit (- Deduct Funds)</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Amount (৳)</label>
                <input
                  type="number"
                  required
                  min={1}
                  value={adjustAmount}
                  onChange={(e) => setAdjustAmount(e.target.value)}
                  placeholder="100"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">Mandatory Reason</label>
                <input
                  type="text"
                  required
                  value={adjustReason}
                  onChange={(e) => setAdjustReason(e.target.value)}
                  placeholder="Bonus / Correction reason"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={busy}
              className="px-5 py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold min-h-[44px]"
            >
              {busy ? 'Applying...' : 'Apply Adjustment'}
            </button>
          </form>

          <div className="bg-white rounded-2xl border border-slate-200 overflow-hidden">
            <div className="p-5 border-b border-slate-200">
              <h3 className="font-display text-base font-bold text-slate-900">
                All Platform Transactions ({transactions.length})
              </h3>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse text-sm">
                <thead>
                  <tr className="border-b border-slate-200 text-xs font-semibold text-slate-500 bg-slate-50">
                    <th className="py-3 px-4">TxID</th>
                    <th className="py-3 px-4">User ID</th>
                    <th className="py-3 px-4">Type</th>
                    <th className="py-3 px-4">Description</th>
                    <th className="py-3 px-4">Status</th>
                    <th className="py-3 px-4 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {transactions.slice(0, 60).map((tx) => (
                    <tr key={tx.id}>
                      <td className="py-3 px-4 font-mono text-xs">{tx.txCode}</td>
                      <td className="py-3 px-4 font-mono text-xs text-slate-500">{tx.userId.slice(0, 10)}...</td>
                      <td className="py-3 px-4 text-xs capitalize">{tx.type.replace(/_/g, ' ')}</td>
                      <td className="py-3 px-4 text-xs max-w-xs truncate">{tx.description}</td>
                      <td className="py-3 px-4"><StatusText status={tx.status} /></td>
                      <td className={`py-3 px-4 font-mono font-bold text-right tabular-nums ${tx.amount >= 0 ? 'text-emerald-700' : 'text-slate-900'}`}>
                        {tx.amount >= 0 ? `+${formatCurrency(tx.amount)}` : formatCurrency(tx.amount)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Create/Edit Task Modal */}
      {taskModalOpen && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-2xl w-full p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {editingTaskId ? 'Edit Task' : 'Create TikTok Task'}
              </h3>
              <button type="button" onClick={() => setTaskModalOpen(false)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Group Name (Required — unlocks this task only for users entering this Group Name)
                </label>
                <input
                  type="text"
                  required
                  list="existing-group-names"
                  value={taskForm.groupName}
                  onChange={(e) => setTaskForm({ ...taskForm, groupName: e.target.value })}
                  placeholder="e.g. TEAM-ALPHA, GROUP-01"
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-medium focus:outline-none focus:border-pink-600"
                />
                <datalist id="existing-group-names">
                  {Array.from(new Set(tasks.map((t) => t.groupName).filter(Boolean))).map((g) => (
                    <option key={g} value={g} />
                  ))}
                </datalist>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Task Title</label>
                  <input
                    type="text"
                    required
                    value={taskForm.title}
                    onChange={(e) => setTaskForm({ ...taskForm, title: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">TikTok Username</label>
                  <input
                    type="text"
                    required
                    value={taskForm.tiktokUsername}
                    onChange={(e) => setTaskForm({ ...taskForm, tiktokUsername: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">TikTok Profile URL</label>
                  <input
                    type="url"
                    required
                    value={taskForm.tiktokUrl}
                    onChange={(e) => setTaskForm({ ...taskForm, tiktokUrl: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Commission (৳)</label>
                  <input
                    type="number"
                    required
                    min={1}
                    value={taskForm.commission}
                    onChange={(e) => setTaskForm({ ...taskForm, commission: e.target.value })}
                    className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm font-mono"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Type</label>
                  <select
                    value={taskForm.taskType}
                    onChange={(e) => setTaskForm({ ...taskForm, taskType: e.target.value as TaskType })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="like">Like</option>
                    <option value="follow">Follow</option>
                    <option value="like_follow">Like &amp; Follow</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Status</label>
                  <select
                    value={taskForm.status}
                    onChange={(e) => setTaskForm({ ...taskForm, status: e.target.value as TaskStatus })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs bg-white"
                  >
                    <option value="active">Active</option>
                    <option value="paused">Paused</option>
                    <option value="expired">Expired</option>
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Start Date</label>
                  <input
                    type="date"
                    required
                    value={taskForm.startDate}
                    onChange={(e) => setTaskForm({ ...taskForm, startDate: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">Deadline</label>
                  <input
                    type="date"
                    required
                    value={taskForm.deadline}
                    onChange={(e) => setTaskForm({ ...taskForm, deadline: e.target.value })}
                    className="w-full px-2.5 py-2.5 rounded-xl border border-slate-200 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Instructions</label>
                <textarea
                  rows={3}
                  required
                  value={taskForm.instructions}
                  onChange={(e) => setTaskForm({ ...taskForm, instructions: e.target.value })}
                  className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
                />
              </div>

              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Assignment Target</label>
                <div className="flex items-center gap-4 mb-2">
                  <label className="inline-flex items-center gap-2 text-xs font-medium">
                    <input
                      type="radio"
                      checked={taskForm.assignMode === 'all'}
                      onChange={() => setTaskForm({ ...taskForm, assignMode: 'all' })}
                    />
                    All Users
                  </label>
                  <label className="inline-flex items-center gap-2 text-xs font-medium">
                    <input
                      type="radio"
                      checked={taskForm.assignMode === 'specific'}
                      onChange={() => setTaskForm({ ...taskForm, assignMode: 'specific' })}
                    />
                    Specific Users (Multi-Select)
                  </label>
                </div>

                {taskForm.assignMode === 'specific' && (
                  <div className="max-h-36 overflow-y-auto border border-slate-200 rounded-xl p-2 space-y-1">
                    {users.map((u) => {
                      const checked = taskForm.assignedUserIds.includes(u.uid);
                      return (
                        <label key={u.uid} className="flex items-center gap-2 text-xs p-1.5 hover:bg-slate-50 rounded-lg cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={(e) => {
                              const next = e.target.checked
                                ? [...taskForm.assignedUserIds, u.uid]
                                : taskForm.assignedUserIds.filter((id) => id !== u.uid);
                              setTaskForm({ ...taskForm, assignedUserIds: next });
                            }}
                          />
                          <span>{u.fullName} (@{u.username})</span>
                        </label>
                      );
                    })}
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={busy}
                className="w-full py-3 rounded-xl bg-pink-600 hover:bg-pink-700 text-white text-sm font-semibold"
              >
                {busy ? 'Saving...' : 'Save Task'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">Edit User</h3>
              <button type="button" onClick={() => setEditingUser(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleSaveUserEdit} className="space-y-3">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Full Name</label>
                <input
                  type="text"
                  required
                  value={editUserForm.fullName}
                  onChange={(e) => setEditUserForm({ ...editUserForm, fullName: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Username</label>
                <input
                  type="text"
                  required
                  value={editUserForm.username}
                  onChange={(e) => setEditUserForm({ ...editUserForm, username: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Mobile</label>
                <input
                  type="text"
                  value={editUserForm.mobile}
                  onChange={(e) => setEditUserForm({ ...editUserForm, mobile: e.target.value })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Account Status</label>
                <select
                  value={editUserForm.status}
                  onChange={(e) => setEditUserForm({ ...editUserForm, status: e.target.value as UserStatus })}
                  className="w-full px-3.5 py-2 rounded-xl border border-slate-200 text-sm bg-white"
                >
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="inactive">Inactive</option>
                  <option value="blocked">Blocked</option>
                </select>
              </div>
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold"
              >
                {busy ? 'Saving...' : 'Update User'}
              </button>
            </form>
          </div>
        </div>
      )}

      {/* Inspect User History Drawer */}
      {inspectUser && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex justify-end">
          <div className="bg-white w-full max-w-lg h-full p-6 overflow-y-auto space-y-5">
            <div className="flex items-center justify-between border-b border-slate-200 pb-4">
              <div>
                <h3 className="font-display text-lg font-bold text-slate-900">{inspectUser.fullName}</h3>
                <p className="text-xs font-mono text-slate-500">{inspectUser.email}</p>
              </div>
              <button type="button" onClick={() => setInspectUser(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">User Transactions</h4>
              <div className="divide-y divide-slate-100 text-xs">
                {transactions.filter((t) => t.userId === inspectUser.uid).map((t) => (
                  <div key={t.id} className="py-2 flex justify-between gap-2">
                    <span>{t.description}</span>
                    <span className="font-mono font-bold">{formatCurrency(t.amount)}</span>
                  </div>
                ))}
              </div>
            </div>
            <div>
              <h4 className="text-xs font-bold uppercase text-slate-500 mb-2">User Task Submissions</h4>
              <div className="divide-y divide-slate-100 text-xs">
                {submissions.filter((s) => s.userId === inspectUser.uid).map((s) => (
                  <div key={s.id} className="py-2 flex justify-between gap-2">
                    <span>{s.taskTitle}</span>
                    <StatusText status={s.status} />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Rejection / Note Modal */}
      {rejectModal && (
        <div className="fixed inset-0 z-50 bg-slate-950/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-200 max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="font-display text-lg font-bold text-slate-900">
                {rejectModal.nextStatus === 'paid' ? 'Confirm Payout Note' : 'Provide Reason / Admin Note'}
              </h3>
              <button type="button" onClick={() => setRejectModal(null)} className="p-2 rounded-lg hover:bg-slate-100">
                <X className="w-4 h-4" />
              </button>
            </div>
            <form onSubmit={handleConfirmRejectOrNote} className="space-y-4">
              <textarea
                rows={3}
                required
                value={reasonText}
                onChange={(e) => setReasonText(e.target.value)}
                placeholder="Enter reason or reference note..."
                className="w-full px-3.5 py-2.5 rounded-xl border border-slate-200 text-sm"
              />
              <button
                type="submit"
                disabled={busy}
                className="w-full py-2.5 rounded-xl bg-navy-900 hover:bg-navy-800 text-white text-sm font-semibold"
              >
                {busy ? 'Processing...' : 'Confirm'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
