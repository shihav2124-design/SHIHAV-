import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  writeBatch,
} from 'firebase/firestore';
import { User } from 'firebase/auth';
import {
  BOOTSTRAPPED_ADMIN_EMAIL,
  db,
  handleFirestoreError,
  OperationType,
} from '@/src/lib/firebase';
import {
  AdminRole,
  DepositMethod,
  DepositRequest,
  Language,
  MarketplaceCategory,
  MarketplaceListing,
  MarketplaceOrder,
  MarketplaceSettings,
  OrderStatus,
  PaymentSettings,
  SiteSettings,
  TaskStatus,
  TaskSubmission,
  TaskType,
  TikTokTask,
  UserProfile,
  UserStatus,
  Wallet,
  WithdrawalMethod,
  WithdrawalRequest,
  WithdrawalStatus,
} from '@/src/types';
import { generateTxCode } from '@/src/lib/imageUtils';
import {
  DEFAULT_MARKETPLACE_SETTINGS,
  DEFAULT_PAYMENT_SETTINGS,
  DEFAULT_SITE_SETTINGS,
} from '@/src/lib/defaults';

function makeId(prefix = 'doc'): string {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return `${prefix}_${crypto.randomUUID().replace(/-/g, '').slice(0, 16)}`;
  }
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 9)}`;
}

const inflightEnsure = new Map<string, Promise<void>>();

export async function ensureUserAndWallet(
  firebaseUser: User,
  extra?: {
    fullName?: string;
    username?: string;
    mobile?: string;
    referralCode?: string;
    language?: Language;
  }
): Promise<void> {
  const existingPromise = inflightEnsure.get(firebaseUser.uid);
  if (existingPromise) {
    await existingPromise;
    if (extra?.fullName || extra?.username || extra?.mobile) {
      const cleanUser = extra.username?.replace(/[^a-zA-Z0-9_.-]/g, '').slice(0, 32);
      const patch: Record<string, any> = { updatedAt: serverTimestamp() };
      if (extra.fullName) patch.fullName = extra.fullName.slice(0, 100);
      if (cleanUser && cleanUser.length >= 3) patch.username = cleanUser;
      if (extra.mobile) patch.mobile = extra.mobile.slice(0, 25);
      await updateDoc(doc(db, 'users', firebaseUser.uid), patch).catch(() => {});
    }
    return;
  }

  const task = (async () => {
    const userRef = doc(db, 'users', firebaseUser.uid);
    const walletRef = doc(db, 'wallets', firebaseUser.uid);

    try {
      const userSnap = await getDoc(userRef);
      const email = firebaseUser.email || 'user@example.com';

      if (!userSnap.exists()) {
        const cleanUsername = (
          extra?.username ||
          email.split('@')[0].replace(/[^a-zA-Z0-9_.-]/g, '') ||
          'member'
        ).slice(0, 32);
        const safeUsername = cleanUsername.length >= 3 ? cleanUsername : `${cleanUsername}01`;
        const myRefCode = `${safeUsername.slice(0, 5).toUpperCase()}${firebaseUser.uid.slice(0, 4).toUpperCase()}`;

        const batch = writeBatch(db);
        batch.set(userRef, {
          uid: firebaseUser.uid,
          fullName: (extra?.fullName || firebaseUser.displayName || safeUsername).slice(0, 100),
          username: safeUsername,
          mobile: (extra?.mobile || '').slice(0, 25),
          email: email.slice(0, 150),
          referralCode: (extra?.referralCode || '').slice(0, 32),
          myReferralCode: myRefCode,
          photoURL: (firebaseUser.photoURL || '').slice(0, 500),
          status: firebaseUser.emailVerified ? 'active' : 'pending',
          emailVerified: firebaseUser.emailVerified,
          language: extra?.language || 'en',
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp(),
        });

        batch.set(walletRef, {
          userId: firebaseUser.uid,
          availableBalance: 0,
          pendingBalance: 0,
          totalEarned: 0,
          totalWithdrawn: 0,
          totalDeposited: 0,
          updatedAt: serverTimestamp(),
        });

        const notifRef = doc(db, 'notifications', makeId('ntf'));
        batch.set(notifRef, {
          userId: firebaseUser.uid,
          title: 'Welcome to PayTasker',
          message: firebaseUser.emailVerified
            ? 'Your account is active. Explore assigned TikTok tasks and wallet features.'
            : 'Please verify your email address to unlock task submissions, deposits, and withdrawals.',
          type: 'system',
          read: false,
          createdAt: serverTimestamp(),
        });

        await batch.commit();
      } else {
        const existingData = userSnap.data() as UserProfile;
        const walletSnap = await getDoc(walletRef);
        if (!walletSnap.exists()) {
          await setDoc(walletRef, {
            userId: firebaseUser.uid,
            availableBalance: 0,
            pendingBalance: 0,
            totalEarned: 0,
            totalWithdrawn: 0,
            totalDeposited: 0,
            updatedAt: serverTimestamp(),
          });
        }
        const userPatch: Record<string, any> = {};
        if (firebaseUser.emailVerified && !existingData.emailVerified) {
          userPatch.emailVerified = true;
          if (existingData.status === 'pending') userPatch.status = 'active';
        }
        if (extra?.fullName && extra.fullName !== existingData.fullName) {
          userPatch.fullName = extra.fullName.slice(0, 100);
        }
        if (extra?.mobile && extra.mobile !== existingData.mobile) {
          userPatch.mobile = extra.mobile.slice(0, 25);
        }
        if (Object.keys(userPatch).length > 0) {
          userPatch.updatedAt = serverTimestamp();
          await updateDoc(userRef, userPatch);
        }
      }

      // Bootstrap admin document if signed in with bootstrapped admin email
      if (email === BOOTSTRAPPED_ADMIN_EMAIL && firebaseUser.emailVerified) {
        const adminRef = doc(db, 'admins', firebaseUser.uid);
        const adminSnap = await getDoc(adminRef);
        if (!adminSnap.exists()) {
          await setDoc(adminRef, {
            uid: firebaseUser.uid,
            email,
            role: 'super_admin',
            permissions: ['users', 'tasks', 'deposits', 'withdrawals', 'wallets', 'settings', 'marketplace', 'admins'],
            createdAt: serverTimestamp(),
          });
        }
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `users/${firebaseUser.uid}`);
    }
  })();

  inflightEnsure.set(firebaseUser.uid, task);
  try {
    await task;
  } finally {
    inflightEnsure.delete(firebaseUser.uid);
  }
}

export async function updateUserProfileFields(
  uid: string,
  updates: { fullName?: string; username?: string; mobile?: string; photoURL?: string; language?: Language; activeGroupName?: string }
): Promise<void> {
  const userRef = doc(db, 'users', uid);
  try {
    await updateDoc(userRef, {
      ...updates,
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${uid}`);
  }
}

export async function claimTaskProject(params: {
  task: TikTokTask;
  user: UserProfile;
}): Promise<void> {
  const subId = `${params.task.id}_${params.user.uid}`;
  const subRef = doc(db, 'taskSubmissions', subId);
  try {
    await setDoc(subRef, {
      taskId: params.task.id,
      taskTitle: params.task.title.slice(0, 140),
      groupName: (params.task.groupName || '').slice(0, 80),
      tiktokUsername: params.task.tiktokUsername.slice(0, 80),
      userId: params.user.uid,
      userName: params.user.fullName.slice(0, 100),
      userEmail: params.user.email.slice(0, 150),
      commission: params.task.commission,
      proofImageData: '',
      note: '',
      status: 'claimed',
      rejectionReason: '',
      reviewedBy: '',
      commissionPaid: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `taskSubmissions/${subId}`);
  }
}

export async function submitTaskProof(params: {
  task?: TikTokTask;
  submission?: TaskSubmission;
  user: UserProfile;
  proofImageData: string;
  note?: string;
  isResubmit?: boolean;
}): Promise<void> {
  const taskId = params.task?.id || params.submission?.taskId;
  if (!taskId) throw new Error('Task reference missing.');
  const subId = `${taskId}_${params.user.uid}`;
  const subRef = doc(db, 'taskSubmissions', subId);
  const groupName = (params.task?.groupName || params.submission?.groupName || '').slice(0, 80);
  try {
    if (params.isResubmit) {
      await updateDoc(subRef, {
        proofImageData: params.proofImageData,
        note: (params.note || '').slice(0, 300),
        groupName,
        status: 'submitted',
        updatedAt: serverTimestamp(),
      });
    } else if (params.task) {
      await setDoc(subRef, {
        taskId: params.task.id,
        taskTitle: params.task.title.slice(0, 140),
        groupName,
        tiktokUsername: params.task.tiktokUsername.slice(0, 80),
        userId: params.user.uid,
        userName: params.user.fullName.slice(0, 100),
        userEmail: params.user.email.slice(0, 150),
        commission: params.task.commission,
        proofImageData: params.proofImageData,
        note: (params.note || '').slice(0, 300),
        status: 'submitted',
        rejectionReason: '',
        reviewedBy: '',
        commissionPaid: false,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `taskSubmissions/${subId}`);
  }
}

export async function adminReviewTaskSubmission(params: {
  submissionId: string;
  action: 'under_review' | 'approved' | 'rejected';
  rejectionReason?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const subRef = doc(db, 'taskSubmissions', params.submissionId);
  try {
    await runTransaction(db, async (tx) => {
      const subSnap = await tx.get(subRef);
      if (!subSnap.exists()) throw new Error('Submission not found.');
      const sub = subSnap.data() as TaskSubmission;

      if (params.action === 'approved') {
        if (sub.commissionPaid || sub.status === 'approved') {
          throw new Error('Commission already credited for this submission.');
        }
        const walletRef = doc(db, 'wallets', sub.userId);
        const walletSnap = await tx.get(walletRef);
        if (!walletSnap.exists()) throw new Error('User wallet not found.');
        const wallet = walletSnap.data() as Wallet;

        tx.update(subRef, {
          status: 'approved',
          commissionPaid: true,
          rejectionReason: '',
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });

        tx.update(walletRef, {
          availableBalance: Number((wallet.availableBalance + sub.commission).toFixed(2)),
          totalEarned: Number((wallet.totalEarned + sub.commission).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        const txRef = doc(db, 'transactions', makeId('tx'));
        tx.set(txRef, {
          txCode: generateTxCode('TSK'),
          userId: sub.userId,
          amount: sub.commission,
          type: 'task_commission',
          status: 'completed',
          description: `Task approved: ${sub.taskTitle}`.slice(0, 250),
          referenceId: params.submissionId,
          createdAt: serverTimestamp(),
        });

        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: sub.userId,
          title: 'Task Approved & Credited',
          message: `Your proof for "${sub.taskTitle}" was approved. ৳${sub.commission} added to your wallet.`,
          type: 'task',
          read: false,
          createdAt: serverTimestamp(),
        });

        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'TASK_APPROVED',
          targetUserId: sub.userId,
          details: `Approved task "${sub.taskTitle}" and paid ৳${sub.commission}`,
          amountDelta: sub.commission,
          createdAt: serverTimestamp(),
        });
      } else if (params.action === 'rejected') {
        if (sub.commissionPaid) throw new Error('Cannot reject an already paid submission.');
        tx.update(subRef, {
          status: 'rejected',
          rejectionReason: (params.rejectionReason || 'Proof did not meet task requirements').slice(0, 300),
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });
        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: sub.userId,
          title: 'Task Submission Rejected',
          message: `Your submission for "${sub.taskTitle}" was rejected: ${params.rejectionReason || 'Check instructions and resubmit.'}`.slice(0, 400),
          type: 'task',
          read: false,
          createdAt: serverTimestamp(),
        });
        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'TASK_REJECTED',
          targetUserId: sub.userId,
          details: `Rejected task "${sub.taskTitle}": ${params.rejectionReason || 'N/A'}`.slice(0, 500),
          amountDelta: 0,
          createdAt: serverTimestamp(),
        });
      } else {
        tx.update(subRef, {
          status: 'under_review',
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `taskSubmissions/${params.submissionId}`);
  }
}

export async function submitDepositRequest(params: {
  user: UserProfile;
  amount: number;
  method: DepositMethod;
  senderNumber: string;
  transactionId: string;
  proofImageData: string;
}): Promise<string> {
  const depId = makeId('dep');
  const depRef = doc(db, 'deposits', depId);
  try {
    await setDoc(depRef, {
      userId: params.user.uid,
      userName: params.user.fullName.slice(0, 100),
      userEmail: params.user.email.slice(0, 150),
      amount: Number(params.amount),
      method: params.method,
      senderNumber: params.senderNumber.trim().slice(0, 25),
      transactionId: params.transactionId.trim().slice(0, 80),
      proofImageData: params.proofImageData,
      status: 'pending',
      rejectionReason: '',
      reviewedBy: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return depId;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `deposits/${depId}`);
  }
}

export async function adminReviewDeposit(params: {
  depositId: string;
  decision: 'approved' | 'rejected';
  rejectionReason?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const depRef = doc(db, 'deposits', params.depositId);
  try {
    await runTransaction(db, async (tx) => {
      const depSnap = await tx.get(depRef);
      if (!depSnap.exists()) throw new Error('Deposit request not found.');
      const dep = depSnap.data() as DepositRequest;
      if (dep.status !== 'pending') throw new Error('Deposit has already been processed.');

      if (params.decision === 'approved') {
        const walletRef = doc(db, 'wallets', dep.userId);
        const walletSnap = await tx.get(walletRef);
        if (!walletSnap.exists()) throw new Error('Wallet not found.');
        const wallet = walletSnap.data() as Wallet;

        tx.update(depRef, {
          status: 'approved',
          reviewedBy: params.adminUid,
          rejectionReason: '',
          updatedAt: serverTimestamp(),
        });

        tx.update(walletRef, {
          availableBalance: Number((wallet.availableBalance + dep.amount).toFixed(2)),
          totalDeposited: Number((wallet.totalDeposited + dep.amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });

        const txRef = doc(db, 'transactions', makeId('tx'));
        tx.set(txRef, {
          txCode: generateTxCode('DEP'),
          userId: dep.userId,
          amount: dep.amount,
          type: 'deposit',
          status: 'completed',
          description: `Deposit via ${dep.method.toUpperCase()} (TrxID: ${dep.transactionId})`.slice(0, 250),
          referenceId: params.depositId,
          createdAt: serverTimestamp(),
        });

        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: dep.userId,
          title: 'Deposit Approved',
          message: `Your deposit of ৳${dep.amount} via ${dep.method.toUpperCase()} has been credited to your wallet.`,
          type: 'deposit',
          read: false,
          createdAt: serverTimestamp(),
        });

        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'DEPOSIT_APPROVED',
          targetUserId: dep.userId,
          details: `Approved deposit ৳${dep.amount} (${dep.method}, TrxID ${dep.transactionId})`,
          amountDelta: dep.amount,
          createdAt: serverTimestamp(),
        });
      } else {
        tx.update(depRef, {
          status: 'rejected',
          rejectionReason: (params.rejectionReason || 'Transaction verification failed').slice(0, 300),
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });

        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: dep.userId,
          title: 'Deposit Rejected',
          message: `Your deposit of ৳${dep.amount} was rejected: ${params.rejectionReason || 'Invalid transaction details'}`.slice(0, 400),
          type: 'deposit',
          read: false,
          createdAt: serverTimestamp(),
        });

        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'DEPOSIT_REJECTED',
          targetUserId: dep.userId,
          details: `Rejected deposit ৳${dep.amount}: ${params.rejectionReason || 'N/A'}`.slice(0, 500),
          amountDelta: 0,
          createdAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `deposits/${params.depositId}`);
  }
}

export async function submitWithdrawalRequest(params: {
  user: UserProfile;
  wallet: Wallet;
  amount: number;
  charge: number;
  method: WithdrawalMethod;
  accountNumber: string;
}): Promise<string> {
  const wdId = makeId('wd');
  const txId = makeId('tx');
  const wdRef = doc(db, 'withdrawals', wdId);
  const walletRef = doc(db, 'wallets', params.user.uid);
  const txRef = doc(db, 'transactions', txId);

  const amount = Number(params.amount);
  const charge = Number(params.charge);
  const netAmount = Number((amount - charge).toFixed(2));

  if (amount <= 0 || amount > params.wallet.availableBalance) {
    throw new Error('Insufficient available balance.');
  }
  if (netAmount <= 0) {
    throw new Error('Net withdrawal amount must be positive.');
  }

  try {
    const batch = writeBatch(db);
    batch.update(walletRef, {
      availableBalance: Number((params.wallet.availableBalance - amount).toFixed(2)),
      pendingBalance: Number((params.wallet.pendingBalance + amount).toFixed(2)),
      updatedAt: serverTimestamp(),
    });

    batch.set(wdRef, {
      userId: params.user.uid,
      userName: params.user.fullName.slice(0, 100),
      userEmail: params.user.email.slice(0, 150),
      amount,
      charge,
      netAmount,
      method: params.method,
      accountNumber: params.accountNumber.trim().slice(0, 25),
      status: 'pending',
      adminNote: '',
      reviewedBy: '',
      fundsResolved: false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(txRef, {
      txCode: generateTxCode('WDR'),
      userId: params.user.uid,
      amount: -amount,
      type: 'withdrawal',
      status: 'pending',
      description: `Withdrawal request via ${params.method.replace('_', ' ')} (${params.accountNumber})`.slice(0, 250),
      referenceId: wdId,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
    return wdId;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `withdrawals/${wdId}`);
  }
}

export async function adminUpdateWithdrawal(params: {
  withdrawalId: string;
  nextStatus: WithdrawalStatus;
  adminNote?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const wdRef = doc(db, 'withdrawals', params.withdrawalId);
  try {
    await runTransaction(db, async (tx) => {
      const wdSnap = await tx.get(wdRef);
      if (!wdSnap.exists()) throw new Error('Withdrawal not found.');
      const wd = wdSnap.data() as WithdrawalRequest;
      if (wd.status === 'paid' || wd.status === 'rejected') {
        throw new Error('Withdrawal is already finalized.');
      }

      const walletRef = doc(db, 'wallets', wd.userId);
      const walletSnap = await tx.get(walletRef);
      if (!walletSnap.exists()) throw new Error('User wallet not found.');
      const wallet = walletSnap.data() as Wallet;

      if (params.nextStatus === 'paid') {
        if (wd.fundsResolved) throw new Error('Reserved funds already resolved.');
        tx.update(wdRef, {
          status: 'paid',
          fundsResolved: true,
          adminNote: (params.adminNote || 'Payment sent').slice(0, 300),
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });
        tx.update(walletRef, {
          pendingBalance: Math.max(0, Number((wallet.pendingBalance - wd.amount).toFixed(2))),
          totalWithdrawn: Number((wallet.totalWithdrawn + wd.amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
        const txRef = doc(db, 'transactions', makeId('tx'));
        tx.set(txRef, {
          txCode: generateTxCode('PAY'),
          userId: wd.userId,
          amount: -wd.amount,
          type: 'withdrawal',
          status: 'completed',
          description: `Withdrawal paid (Net ৳${wd.netAmount}) to ${wd.accountNumber}`.slice(0, 250),
          referenceId: params.withdrawalId,
          createdAt: serverTimestamp(),
        });
        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: wd.userId,
          title: 'Withdrawal Paid',
          message: `Your withdrawal of ৳${wd.amount} (Net ৳${wd.netAmount}) has been sent to ${wd.accountNumber}.`,
          type: 'withdrawal',
          read: false,
          createdAt: serverTimestamp(),
        });
        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'WITHDRAWAL_PAID',
          targetUserId: wd.userId,
          details: `Marked withdrawal ৳${wd.amount} paid to ${wd.accountNumber}`,
          amountDelta: -wd.amount,
          createdAt: serverTimestamp(),
        });
      } else if (params.nextStatus === 'rejected') {
        if (wd.fundsResolved) throw new Error('Reserved funds already resolved.');
        tx.update(wdRef, {
          status: 'rejected',
          fundsResolved: true,
          adminNote: (params.adminNote || 'Withdrawal rejected & refunded').slice(0, 300),
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });
        tx.update(walletRef, {
          pendingBalance: Math.max(0, Number((wallet.pendingBalance - wd.amount).toFixed(2))),
          availableBalance: Number((wallet.availableBalance + wd.amount).toFixed(2)),
          updatedAt: serverTimestamp(),
        });
        const txRef = doc(db, 'transactions', makeId('tx'));
        tx.set(txRef, {
          txCode: generateTxCode('RFD'),
          userId: wd.userId,
          amount: wd.amount,
          type: 'withdrawal_refund',
          status: 'refunded',
          description: `Refund for rejected withdrawal (${params.adminNote || 'Rejected'})`.slice(0, 250),
          referenceId: params.withdrawalId,
          createdAt: serverTimestamp(),
        });
        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: wd.userId,
          title: 'Withdrawal Rejected & Refunded',
          message: `Your withdrawal of ৳${wd.amount} was rejected and refunded to your available balance. Note: ${params.adminNote || 'N/A'}`.slice(0, 400),
          type: 'withdrawal',
          read: false,
          createdAt: serverTimestamp(),
        });
        const auditRef = doc(db, 'auditLogs', makeId('aud'));
        tx.set(auditRef, {
          actorId: params.adminUid,
          actorEmail: params.adminEmail,
          action: 'WITHDRAWAL_REJECTED_REFUND',
          targetUserId: wd.userId,
          details: `Rejected & refunded ৳${wd.amount}: ${params.adminNote || 'N/A'}`.slice(0, 500),
          amountDelta: wd.amount,
          createdAt: serverTimestamp(),
        });
      } else {
        tx.update(wdRef, {
          status: params.nextStatus,
          adminNote: (params.adminNote || wd.adminNote || '').slice(0, 300),
          reviewedBy: params.adminUid,
          updatedAt: serverTimestamp(),
        });
        const ntfRef = doc(db, 'notifications', makeId('ntf'));
        tx.set(ntfRef, {
          userId: wd.userId,
          title: `Withdrawal ${params.nextStatus.toUpperCase()}`,
          message: `Your withdrawal request of ৳${wd.amount} is now ${params.nextStatus}.`,
          type: 'withdrawal',
          read: false,
          createdAt: serverTimestamp(),
        });
      }
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `withdrawals/${params.withdrawalId}`);
  }
}

export async function adminManualWalletAdjustment(params: {
  targetUserId: string;
  mode: 'credit' | 'debit';
  amount: number;
  reason: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  if (!params.reason.trim()) throw new Error('Adjustment reason is mandatory.');
  if (params.amount <= 0) throw new Error('Amount must be positive.');
  const walletRef = doc(db, 'wallets', params.targetUserId);

  try {
    await runTransaction(db, async (tx) => {
      const wSnap = await tx.get(walletRef);
      if (!wSnap.exists()) throw new Error('Target wallet not found.');
      const wallet = wSnap.data() as Wallet;
      const delta = params.mode === 'credit' ? params.amount : -params.amount;
      const newBalance = Number((wallet.availableBalance + delta).toFixed(2));
      if (newBalance < 0) throw new Error('Cannot debit more than available balance.');

      tx.update(walletRef, {
        availableBalance: newBalance,
        updatedAt: serverTimestamp(),
      });

      const txRef = doc(db, 'transactions', makeId('tx'));
      tx.set(txRef, {
        txCode: generateTxCode('ADJ'),
        userId: params.targetUserId,
        amount: delta,
        type: 'admin_adjustment',
        status: 'completed',
        description: `Admin adjustment: ${params.reason}`.slice(0, 250),
        referenceId: params.adminUid,
        createdAt: serverTimestamp(),
      });

      const ntfRef = doc(db, 'notifications', makeId('ntf'));
      tx.set(ntfRef, {
        userId: params.targetUserId,
        title: 'Wallet Balance Adjusted',
        message: `Admin ${params.mode === 'credit' ? 'credited' : 'debited'} ৳${params.amount}. Reason: ${params.reason}`.slice(0, 400),
        type: 'system',
        read: false,
        createdAt: serverTimestamp(),
      });

      const auditRef = doc(db, 'auditLogs', makeId('aud'));
      tx.set(auditRef, {
        actorId: params.adminUid,
        actorEmail: params.adminEmail,
        action: `WALLET_MANUAL_${params.mode.toUpperCase()}`,
        targetUserId: params.targetUserId,
        details: `${params.mode.toUpperCase()} ৳${params.amount} — ${params.reason}`.slice(0, 500),
        amountDelta: delta,
        createdAt: serverTimestamp(),
      });
    });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `wallets/${params.targetUserId}`);
  }
}

export async function adminSaveTask(params: {
  taskId?: string;
  title: string;
  groupName: string;
  tiktokUsername: string;
  tiktokUrl: string;
  instructions: string;
  taskType: TaskType;
  commission: number;
  startDate: string;
  deadline: string;
  status: TaskStatus;
  assignMode: 'all' | 'specific';
  assignedUserIds: string[];
  adminUid: string;
  adminEmail: string;
}): Promise<string> {
  const id = params.taskId || makeId('tsk');
  const taskRef = doc(db, 'tasks', id);
  const cleanGroup = params.groupName.trim().slice(0, 80);
  const groupNameKey = cleanGroup.toLowerCase();
  if (!cleanGroup) throw new Error('Group Name is required for task assignment.');
  try {
    if (params.taskId) {
      await updateDoc(taskRef, {
        title: params.title.trim().slice(0, 140),
        groupName: cleanGroup,
        groupNameKey,
        tiktokUsername: params.tiktokUsername.trim().slice(0, 80),
        tiktokUrl: params.tiktokUrl.trim().slice(0, 300),
        instructions: params.instructions.trim().slice(0, 1000),
        taskType: params.taskType,
        commission: Number(params.commission),
        startDate: params.startDate,
        deadline: params.deadline,
        status: params.status,
        assignMode: params.assignMode,
        assignedUserIds: params.assignedUserIds.slice(0, 50),
        updatedAt: serverTimestamp(),
      });
    } else {
      const batch = writeBatch(db);
      batch.set(taskRef, {
        title: params.title.trim().slice(0, 140),
        groupName: cleanGroup,
        groupNameKey,
        tiktokUsername: params.tiktokUsername.trim().slice(0, 80),
        tiktokUrl: params.tiktokUrl.trim().slice(0, 300),
        instructions: params.instructions.trim().slice(0, 1000),
        taskType: params.taskType,
        commission: Number(params.commission),
        startDate: params.startDate,
        deadline: params.deadline,
        status: params.status,
        assignMode: params.assignMode,
        assignedUserIds: params.assignedUserIds.slice(0, 50),
        createdBy: params.adminUid,
        createdAt: serverTimestamp(),
        updatedAt: serverTimestamp(),
      });

      if (params.assignMode === 'specific') {
        params.assignedUserIds.slice(0, 20).forEach((uid) => {
          const ntfRef = doc(db, 'notifications', makeId('ntf'));
          batch.set(ntfRef, {
            userId: uid,
            title: 'New TikTok Task Assigned',
            message: `New task "${params.title}" (Group: ${cleanGroup}, ৳${params.commission} commission) assigned to you.`,
            type: 'task',
            read: false,
            createdAt: serverTimestamp(),
          });
        });
      }

      const auditRef = doc(db, 'auditLogs', makeId('aud'));
      batch.set(auditRef, {
        actorId: params.adminUid,
        actorEmail: params.adminEmail,
        action: 'TASK_CREATED',
        targetUserId: '',
        details: `Created task "${params.title}" for group "${cleanGroup}" (৳${params.commission})`,
        amountDelta: 0,
        createdAt: serverTimestamp(),
      });

      await batch.commit();
    }
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `tasks/${id}`);
  }
}

export async function adminDeleteTask(taskId: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'tasks', taskId));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `tasks/${taskId}`);
  }
}

export async function createMarketplaceListing(params: {
  category: MarketplaceCategory;
  listingType: 'buy_catalog' | 'sell_offer';
  sellerId: string;
  sellerName: string;
  accountHandle: string;
  profileUrl?: string;
  followersCount: number;
  accountAgeOrRegion?: string;
  details: string;
  price: number;
  proofImageData?: string;
  isAdminCreated?: boolean;
}): Promise<string> {
  const id = makeId('mkt');
  const ref = doc(db, 'marketplaceListings', id);
  try {
    await setDoc(ref, {
      category: params.category,
      listingType: params.listingType,
      sellerId: params.sellerId,
      sellerName: params.sellerName.slice(0, 100),
      accountHandle: params.accountHandle.trim().slice(0, 120),
      profileUrl: (params.profileUrl || '').trim().slice(0, 300),
      followersCount: Number(params.followersCount || 0),
      accountAgeOrRegion: (params.accountAgeOrRegion || '').trim().slice(0, 100),
      details: params.details.trim().slice(0, 1000),
      price: Number(params.price),
      proofImageData: params.proofImageData || '',
      verificationNote: params.isAdminCreated ? 'Verified Platform Listing' : 'Pending Admin Verification',
      status: params.isAdminCreated ? 'approved' : 'pending_review',
      rejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `marketplaceListings/${id}`);
  }
}

export async function adminUpdateListing(params: {
  listingId: string;
  status: 'approved' | 'rejected' | 'sold' | 'pending_review';
  price?: number;
  rejectionReason?: string;
  verificationNote?: string;
  listing?: MarketplaceListing;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const ref = doc(db, 'marketplaceListings', params.listingId);
  try {
    const batch = writeBatch(db);
    const updateData: Record<string, any> = {
      status: params.status,
      updatedAt: serverTimestamp(),
    };
    if (typeof params.price === 'number' && params.price > 0) updateData.price = params.price;
    if (params.rejectionReason !== undefined) updateData.rejectionReason = params.rejectionReason.slice(0, 300);
    if (params.verificationNote !== undefined) updateData.verificationNote = params.verificationNote.slice(0, 300);

    batch.update(ref, updateData);

    if (params.listing && params.listing.sellerId !== params.adminUid) {
      const ntfRef = doc(db, 'notifications', makeId('ntf'));
      batch.set(ntfRef, {
        userId: params.listing.sellerId,
        title: `Marketplace Listing ${params.status.toUpperCase()}`,
        message: `Your ${params.listing.category.toUpperCase()} listing (${params.listing.accountHandle}) status is now ${params.status}.`,
        type: 'marketplace',
        read: false,
        createdAt: serverTimestamp(),
      });
    }

    const auditRef = doc(db, 'auditLogs', makeId('aud'));
    batch.set(auditRef, {
      actorId: params.adminUid,
      actorEmail: params.adminEmail,
      action: `LISTING_${params.status.toUpperCase()}`,
      targetUserId: params.listing?.sellerId || '',
      details: `Updated listing ${params.listingId} to ${params.status}`,
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `marketplaceListings/${params.listingId}`);
  }
}

export async function createMarketplaceOrder(params: {
  listing: MarketplaceListing;
  buyer: UserProfile;
  contactMethod: string;
  buyerNote?: string;
}): Promise<string> {
  const id = makeId('ord');
  const ref = doc(db, 'marketplaceOrders', id);
  try {
    await setDoc(ref, {
      listingId: params.listing.id,
      category: params.listing.category,
      accountHandle: params.listing.accountHandle,
      buyerId: params.buyer.uid,
      buyerName: params.buyer.fullName.slice(0, 100),
      buyerEmail: params.buyer.email.slice(0, 150),
      sellerId: params.listing.sellerId,
      price: params.listing.price,
      contactMethod: params.contactMethod.trim().slice(0, 120),
      buyerNote: (params.buyerNote || '').trim().slice(0, 400),
      status: 'pending',
      adminNote: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });
    return id;
  } catch (error) {
    handleFirestoreError(error, OperationType.CREATE, `marketplaceOrders/${id}`);
  }
}

export async function adminUpdateMarketplaceOrder(params: {
  order: MarketplaceOrder;
  status: OrderStatus;
  adminNote?: string;
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const ordRef = doc(db, 'marketplaceOrders', params.order.id);
  const listingRef = doc(db, 'marketplaceListings', params.order.listingId);
  try {
    const batch = writeBatch(db);
    batch.update(ordRef, {
      status: params.status,
      adminNote: (params.adminNote || '').slice(0, 300),
      updatedAt: serverTimestamp(),
    });
    if (params.status === 'completed') {
      batch.update(listingRef, {
        status: 'sold',
        updatedAt: serverTimestamp(),
      });
    }
    const ntfRef = doc(db, 'notifications', makeId('ntf'));
    batch.set(ntfRef, {
      userId: params.order.buyerId,
      title: `Order ${params.status.toUpperCase()}`,
      message: `Your purchase request for ${params.order.accountHandle} is now ${params.status}. ${params.adminNote || ''}`.slice(0, 400),
      type: 'marketplace',
      read: false,
      createdAt: serverTimestamp(),
    });
    const auditRef = doc(db, 'auditLogs', makeId('aud'));
    batch.set(auditRef, {
      actorId: params.adminUid,
      actorEmail: params.adminEmail,
      action: `ORDER_${params.status.toUpperCase()}`,
      targetUserId: params.order.buyerId,
      details: `Marketplace order ${params.order.id} (${params.order.accountHandle}) -> ${params.status}`,
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `marketplaceOrders/${params.order.id}`);
  }
}

export async function adminUpdateUserAccount(params: {
  targetUid: string;
  updates: { fullName?: string; username?: string; mobile?: string; status?: UserStatus };
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const userRef = doc(db, 'users', params.targetUid);
  try {
    const batch = writeBatch(db);
    batch.update(userRef, {
      ...params.updates,
      updatedAt: serverTimestamp(),
    });
    const auditRef = doc(db, 'auditLogs', makeId('aud'));
    batch.set(auditRef, {
      actorId: params.adminUid,
      actorEmail: params.adminEmail,
      action: 'USER_UPDATED',
      targetUserId: params.targetUid,
      details: `Updated user ${params.targetUid}: ${JSON.stringify(params.updates)}`.slice(0, 500),
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `users/${params.targetUid}`);
  }
}

export async function adminSaveSettings(
  key: 'site' | 'payments' | 'marketplace',
  data: SiteSettings | PaymentSettings | MarketplaceSettings,
  adminUid: string,
  adminEmail: string
): Promise<void> {
  const ref = doc(db, 'settings', key);
  try {
    const batch = writeBatch(db);
    batch.set(ref, {
      key,
      data,
      updatedAt: serverTimestamp(),
    });
    const auditRef = doc(db, 'auditLogs', makeId('aud'));
    batch.set(auditRef, {
      actorId: adminUid,
      actorEmail: adminEmail,
      action: `SETTINGS_UPDATED_${key.toUpperCase()}`,
      targetUserId: '',
      details: `Updated ${key} configuration`,
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `settings/${key}`);
  }
}

export async function adminAssignRole(params: {
  targetUid: string;
  targetEmail: string;
  role: AdminRole['role'];
  permissions: string[];
  adminUid: string;
  adminEmail: string;
}): Promise<void> {
  const ref = doc(db, 'admins', params.targetUid);
  try {
    const batch = writeBatch(db);
    batch.set(ref, {
      uid: params.targetUid,
      email: params.targetEmail.slice(0, 150),
      role: params.role,
      permissions: params.permissions.slice(0, 20),
      createdAt: serverTimestamp(),
    });
    const auditRef = doc(db, 'auditLogs', makeId('aud'));
    batch.set(auditRef, {
      actorId: params.adminUid,
      actorEmail: params.adminEmail,
      action: 'ADMIN_ROLE_ASSIGNED',
      targetUserId: params.targetUid,
      details: `Assigned role ${params.role} to ${params.targetEmail}`,
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });
    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, `admins/${params.targetUid}`);
  }
}

export async function adminRevokeRole(targetUid: string): Promise<void> {
  try {
    await deleteDoc(doc(db, 'admins', targetUid));
  } catch (error) {
    handleFirestoreError(error, OperationType.DELETE, `admins/${targetUid}`);
  }
}

export async function markNotificationRead(notifId: string): Promise<void> {
  try {
    await updateDoc(doc(db, 'notifications', notifId), { read: true });
  } catch (error) {
    handleFirestoreError(error, OperationType.UPDATE, `notifications/${notifId}`);
  }
}

export async function adminSeedInitialData(adminUid: string, adminEmail: string): Promise<void> {
  try {
    const batch = writeBatch(db);
    batch.set(doc(db, 'settings', 'site'), {
      key: 'site',
      data: DEFAULT_SITE_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'settings', 'payments'), {
      key: 'payments',
      data: DEFAULT_PAYMENT_SETTINGS,
      updatedAt: serverTimestamp(),
    });
    batch.set(doc(db, 'settings', 'marketplace'), {
      key: 'marketplace',
      data: DEFAULT_MARKETPLACE_SETTINGS,
      updatedAt: serverTimestamp(),
    });

    const today = new Date().toISOString().slice(0, 10);
    const nextWeek = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);

    batch.set(doc(db, 'tasks', makeId('tsk')), {
      title: 'Follow & Like Creator Tech Channel',
      groupName: 'TEAM-ALPHA',
      groupNameKey: 'team-alpha',
      tiktokUsername: '@dhaka_tech_daily',
      tiktokUrl: 'https://www.tiktok.com/@tiktok',
      instructions: 'Open the TikTok profile, tap Follow, like the latest 2 videos, and upload a clear screenshot showing Following status.',
      taskType: 'like_follow',
      commission: 25,
      startDate: today,
      deadline: nextWeek,
      status: 'active',
      assignMode: 'all',
      assignedUserIds: [],
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'tasks', makeId('tsk')), {
      title: 'Follow Culinary Studio Showcase',
      groupName: 'TEAM-ALPHA',
      groupNameKey: 'team-alpha',
      tiktokUsername: '@bengali_kitchen_pro',
      tiktokUrl: 'https://www.tiktok.com/@tiktok',
      instructions: 'Follow the account and leave a heart reaction on the pinned reel. Upload proof screenshot.',
      taskType: 'follow',
      commission: 18,
      startDate: today,
      deadline: nextWeek,
      status: 'active',
      assignMode: 'all',
      assignedUserIds: [],
      createdBy: adminUid,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'marketplaceListings', makeId('mkt')), {
      category: 'tiktok',
      listingType: 'buy_catalog',
      sellerId: adminUid,
      sellerName: 'Verified Escrow Desk',
      accountHandle: '@lifestyle_bd_creator',
      profileUrl: 'https://www.tiktok.com/@tiktok',
      followersCount: 14800,
      accountAgeOrRegion: 'Bangladesh · 2023 Creator Account',
      details: 'Organic lifestyle niche, 14.8K active followers, clean strike history, eligible for live streaming and creator tools.',
      price: 3800,
      proofImageData: '',
      verificationNote: 'Ownership & analytics verified by Admin Desk',
      status: 'approved',
      rejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'marketplaceListings', makeId('mkt')), {
      category: 'gmail',
      listingType: 'buy_catalog',
      sellerId: adminUid,
      sellerName: 'Verified Escrow Desk',
      accountHandle: 'aged.us.2019***@gmail.com',
      profileUrl: '',
      followersCount: 0,
      accountAgeOrRegion: 'USA IP · Created 2019 · Fresh Recovery',
      details: 'Clean 2019 aged Google workspace-ready Gmail ID. Transferred securely via admin escrow with immediate recovery email handover.',
      price: 450,
      proofImageData: '',
      verificationNote: 'Age & clean reputation verified',
      status: 'approved',
      rejectionReason: '',
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp(),
    });

    batch.set(doc(db, 'auditLogs', makeId('aud')), {
      actorId: adminUid,
      actorEmail: adminEmail,
      action: 'INITIAL_PLATFORM_SEED',
      targetUserId: '',
      details: 'Initialized default settings, sample TikTok tasks, and verified marketplace catalog.',
      amountDelta: 0,
      createdAt: serverTimestamp(),
    });

    await batch.commit();
  } catch (error) {
    handleFirestoreError(error, OperationType.WRITE, 'settings/site');
  }
}
