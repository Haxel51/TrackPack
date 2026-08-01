export type WaybillStatus = 'Draft' | 'Booked' | 'Departed' | 'In Transit' | 'Arrived' | 'Collected' | 'Delivered';

export interface Waybill {
  id?: string;
  trackingCode: string;
  senderName: string;
  senderPhone: string;
  receiverName: string;
  receiverPhone: string;
  itemDescription: string;
  busNumber: string;
  originPark: string;
  destinationPark: string;
  status: WaybillStatus;
  createdTimestamp: number;
  departedTimestamp?: number;
  arrivedTimestamp?: number;
  collectedTimestamp?: number;
  pickupCode: string;
  driverName?: string;
  driverPhone?: string;
  liveTrackingActive?: boolean;
  deliveryFee?: number;
  paymentMethod?: 'paystack_online' | 'cash_at_park' | 'bank_transfer';
  companyId?: string;
  companyName?: string;
  statusNote?: string;
  delayReason?: string;
  paymentStatus?: 'pending' | 'success' | 'expired' | null;
  paystackReference?: string;
  paymentVirtualAccount?: {
    accountName: string;
    accountNumber: string;
    bankName: string;
    reference: string;
    expiresAt: string;
    amount: number;
  };
}

export interface Company {
  id?: string;
  name: string;
  parks: string[];
  ownerPhone: string;
  cacNumber?: string;
  kycNumber?: string;
  bankName?: string;
  accountNumber?: string;
  accountName?: string;
  bankAccount?: string;
  paystackSubaccountCode?: string;
  approved?: boolean;
  status?: 'active' | 'suspended';
  commissionRate?: number;
  contactEmail?: string;
  cacDocumentUrl?: string;
  kycDocumentUrl?: string;
  passwordHash?: string;
}

export interface Staff {
  id?: string;
  name: string;
  park: string;
  pin: string;
  companyId: string;
  role: 'sender' | 'receiver';
  isActive?: boolean;
}

export interface Lead {
  id?: string;
  name: string;
  phone: string;
  companyName: string;
  parkLocation: string;
  timestamp: number;
}

export type UserRole = 'sender' | 'receiver' | 'customer' | 'admin' | null;

export interface SessionUser {
  role: UserRole;
  phone?: string;
  pin?: string;
  park?: string;
  companyId?: string;
  name?: string;
}
