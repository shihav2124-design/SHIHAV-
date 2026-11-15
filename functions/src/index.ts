/**
 * Optional Firebase Cloud Functions (2nd Gen) for server-side transaction verification
 * Deploy with: firebase deploy --only functions (requires Firebase Blaze plan)
 */
import * as admin from 'firebase-admin';
import { onCall, HttpsError } from 'firebase-functions/v2/https';

admin.initializeApp();
const db = admin.firestore();

async function assertAdmin(uid?: string, email?: string) {
  if (!uid) throw new HttpsError('unauthenticated', 'Authentication required.');
  if (email === 'smmservicehelpcentre@gmail.com') return;
  const adminDoc = await db.collection('admins').doc(uid).get();
  if (!adminDoc.exists) {
    throw new HttpsError('permission-denied', 'Admin privileges required.');
  }
}

export const approveTaskSubmission = onCall(async (request) => {
  await assertAdmin(request.auth?.uid, request.auth?.token.email);
  const { submissionId } = request.data as { submissionId: string };
  if (!submissionId) throw new HttpsError('invalid-argument', 'submissionId is required.');

  const subRef = db.collection('taskSubmissions').doc(submissionId);
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(subRef);
    if (!snap.exists) throw new HttpsError('not-found', 'Submission not found.');
    const sub = snap.data()!;
    if (sub.commissionPaid || sub.status === 'approved') {
      throw new HttpsError('already-exists', 'Commission already paid.');
    }

    const walletRef = db.collection('wallets').doc(sub.userId);
    const walletSnap = await tx.get(walletRef);
    if (!walletSnap.exists) throw new HttpsError('not-found', 'Wallet not found.');
    const wallet = walletSnap.data()!;

    tx.update(subRef, {
      status: 'approved',
      commissionPaid: true,
      reviewedBy: request.auth!.uid,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.update(walletRef, {
      availableBalance: Number((wallet.availableBalance + sub.commission).toFixed(2)),
      totalEarned: Number((wallet.totalEarned + sub.commission).toFixed(2)),
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    tx.set(db.collection('transactions').doc(), {
      txCode: `TSK-${Date.now().toString(36).toUpperCase()}`,
      userId: sub.userId,
      amount: sub.commission,
      type: 'task_commission',
      status: 'completed',
      description: `Task approved: ${sub.taskTitle}`,
      referenceId: submissionId,
      createdAt: admin.firestore.FieldValue.serverTimestamp(),
    });
  });

  return { ok: true };
});
