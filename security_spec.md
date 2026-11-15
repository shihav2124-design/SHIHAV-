# Security Specification & Threat Model

## 1. Core Data Invariants
1. **Zero Self-Crediting Wallet Invariant**: A non-admin user can never increase `availableBalance`, `totalEarned`, `totalDeposited`, or `totalWithdrawn` on `wallets/{userId}`. Initial creation requires all numeric fields strictly `== 0`.
2. **Atomic Withdrawal Reservation Invariant**: A user submitting a withdrawal can only decrease `availableBalance` by exact `amount > 0` and increase `pendingBalance` by the exact same `amount`, while atomically creating a `pending` withdrawal document (`existsAfter`) and `pending` transaction ledger entry.
3. **Duplicate Commission Prevention**: Task submissions use deterministic document IDs (`{taskId}_{userId}`), and `commissionPaid` starts as `false`. Once `status == 'approved'` (terminal state), non-admins cannot modify it, and admins only credit once when `commissionPaid == false`.
4. **PII Isolation**: `users/{userId}` contains `email`, `mobile`, and `fullName` and is strictly readable only by the document owner (`request.auth.uid == userId`) or verified admins (`isAdmin()`).
5. **Privilege Escalation Prevention**: Users cannot create or modify `/admins/{uid}`, and cannot change their `status` field (`active` / `blocked`) on `/users/{uid}`.
6. **Verified Email Requirement**: Sensitive mutations (task submissions, deposits, withdrawals, marketplace listings/orders, and admin operations) require `request.auth.token.email_verified == true`.
7. **Credential Privacy Safeguard**: Marketplace listings and orders never store or accept account passwords or recovery codes.

## 2. The "Dirty Dozen" Adversarial Payloads
1. **Self-Credit Wallet Attack**: `{ "userId": "u1", "availableBalance": 50000, "pendingBalance": 0, ... }` on `wallets/u1` create/update -> `PERMISSION_DENIED`.
2. **Ghost Field Shadow Update on User Profile**: `{ "status": "active", "isAdmin": true }` on `users/u1` update -> `PERMISSION_DENIED`.
3. **Unverified Email Admin Spoof**: Token with `email: "smmservicehelpcentre@gmail.com", email_verified: false` reading `/auditLogs` -> `PERMISSION_DENIED`.
4. **Cross-User PII Scraping**: User `u2` calling `get` or `list` on `/users` or `/users/u1` -> `PERMISSION_DENIED`.
5. **Blanket Transaction List Query**: User `u2` querying `transactions` without `where("userId", "==", "u2")` -> `PERMISSION_DENIED`.
6. **Terminal State Bypass on Approved Submission**: User `u1` updating `taskSubmissions/t1_u1` after `status == 'approved'` to reset status -> `PERMISSION_DENIED`.
7. **Duplicate Commission Submission ID Spoof**: User `u1` creating `taskSubmissions/randomId` where ID != `taskId + "_" + userId` or `commissionPaid: true` -> `PERMISSION_DENIED`.
8. **Orphaned Task Submission**: User `u1` creating `taskSubmissions/nonExistentTask_u1` when `/tasks/nonExistentTask` does not exist -> `PERMISSION_DENIED`.
9. **Resource Exhaustion / 1MB String Poisoning**: Passing a 1.5KB junk document ID or 500KB string in `title` -> `PERMISSION_DENIED`.
10. **Client Timestamp Forgery**: Creating a deposit or withdrawal with backdated `createdAt` (`!= request.time`) -> `PERMISSION_DENIED`.
11. **Withdrawal Negative Amount / Overdraft Attack**: Updating `wallets/u1` with `availableBalance: -100` or `amount: -500` -> `PERMISSION_DENIED`.
12. **Fake Deposit Self-Approval**: User `u1` creating `deposits/d1` with `status: "approved"` -> `PERMISSION_DENIED`.
