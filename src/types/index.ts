export type Language = 'en' | 'bn';

export type UserStatus = 'active' | 'pending' | 'blocked' | 'inactive';

export interface UserProfile {
  uid: string;
  fullName: string;
  username: string;
  mobile: string;
  email: string;
  referralCode?: string;
  myReferralCode: string;
  photoURL?: string;
  status: UserStatus;
  emailVerified: boolean;
  language: Language;
  activeGroupName?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AdminRole {
  uid: string;
  email: string;
  role: 'super_admin' | 'moderator' | 'finance_admin';
  permissions: string[];
  createdAt: any;
}

export interface Wallet {
  userId: string;
  availableBalance: number;
  pendingBalance: number;
  totalEarned: number;
  totalWithdrawn: number;
  totalDeposited: number;
  updatedAt: any;
}

export type TaskType = 'like' | 'follow' | 'like_follow' | 'other';
export type TaskStatus = 'active' | 'paused' | 'expired';

export interface TikTokTask {
  id: string;
  title: string;
  groupName: string;
  groupNameKey: string;
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
  createdBy: string;
  createdAt: any;
  updatedAt: any;
}

export type SubmissionStatus = 'claimed' | 'submitted' | 'under_review' | 'approved' | 'rejected';

export interface TaskSubmission {
  id: string;
  taskId: string;
  taskTitle: string;
  groupName?: string;
  tiktokUsername: string;
  userId: string;
  userName: string;
  userEmail: string;
  commission: number;
  proofImageData: string;
  note?: string;
  status: SubmissionStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  commissionPaid: boolean;
  createdAt: any;
  updatedAt: any;
}

export type DepositMethod = 'bkash' | 'nagad' | 'rocket';
export type DepositStatus = 'pending' | 'approved' | 'rejected';

export interface DepositRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  method: DepositMethod;
  senderNumber: string;
  transactionId: string;
  proofImageData: string;
  status: DepositStatus;
  rejectionReason?: string;
  reviewedBy?: string;
  createdAt: any;
  updatedAt: any;
}

export type WithdrawalMethod = 'bkash_personal' | 'nagad_personal' | 'rocket_personal';
export type WithdrawalStatus = 'pending' | 'processing' | 'approved' | 'paid' | 'rejected';

export interface WithdrawalRequest {
  id: string;
  userId: string;
  userName: string;
  userEmail: string;
  amount: number;
  charge: number;
  netAmount: number;
  method: WithdrawalMethod;
  accountNumber: string;
  status: WithdrawalStatus;
  adminNote?: string;
  reviewedBy?: string;
  fundsResolved: boolean;
  createdAt: any;
  updatedAt: any;
}

export type TransactionType =
  | 'deposit'
  | 'withdrawal'
  | 'withdrawal_refund'
  | 'task_commission'
  | 'marketplace_buy'
  | 'marketplace_sell'
  | 'admin_adjustment';

export type TransactionStatus = 'pending' | 'completed' | 'failed' | 'refunded';

export interface TransactionRecord {
  id: string;
  txCode: string;
  userId: string;
  amount: number;
  type: TransactionType;
  status: TransactionStatus;
  description: string;
  referenceId?: string;
  createdAt: any;
}

export type MarketplaceCategory = 'tiktok' | 'gmail';
export type ListingStatus = 'pending_review' | 'approved' | 'sold' | 'rejected';

export interface MarketplaceListing {
  id: string;
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
  verificationNote?: string;
  status: ListingStatus;
  rejectionReason?: string;
  createdAt: any;
  updatedAt: any;
}

export type OrderStatus = 'pending' | 'verified' | 'completed' | 'cancelled';

export interface MarketplaceOrder {
  id: string;
  listingId: string;
  category: MarketplaceCategory;
  accountHandle: string;
  buyerId: string;
  buyerName: string;
  buyerEmail: string;
  sellerId: string;
  price: number;
  contactMethod: string;
  buyerNote?: string;
  status: OrderStatus;
  adminNote?: string;
  createdAt: any;
  updatedAt: any;
}

export interface AppNotification {
  id: string;
  userId: string;
  title: string;
  message: string;
  type: 'task' | 'deposit' | 'withdrawal' | 'marketplace' | 'system';
  read: boolean;
  createdAt: any;
}

export interface SiteSettings {
  brandName: string;
  logoUrl: string;
  bannerTitle: string;
  bannerSubtitle: string;
  noticeText: string;
  whatsappNumber: string;
  supportLink: string;
  websiteStatus: 'live' | 'maintenance';
  registrationOpen: boolean;
}

export interface PaymentSettings {
  bkashNumber: string;
  nagadNumber: string;
  rocketNumber: string;
  depositInstructions: string;
  minDeposit: number;
  withdrawalInstructions: string;
  minWithdrawal: number;
  maxWithdrawal: number;
  withdrawalChargePercent: number;
  processingTime: string;
}

export interface MarketplaceSettings {
  tiktokBuyEnabled: boolean;
  tiktokSellEnabled: boolean;
  gmailBuyEnabled: boolean;
  gmailSellEnabled: boolean;
  escrowNotice: string;
}

export interface AuditLog {
  id: string;
  actorId: string;
  actorEmail: string;
  action: string;
  targetUserId?: string;
  details: string;
  amountDelta: number;
  createdAt: any;
}
