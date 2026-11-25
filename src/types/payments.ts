export type FineStatus = 'pending' | 'paid';
export type PaymentTransactionStatus = 'pending' | 'success' | 'failed';

/** Firestore document `fines/{sessionId}_{studentId}`. */
export interface FineRecord {
  id: string;
  studentId: string;
  studentName: string;
  studentIdentifier: string;
  sessionId: string;
  classId: string;
  labId: string;
  attendanceId: string;
  practicalName: string;
  sessionDate: string;
  amount: number;
  lateMinutes: number;
  status: FineStatus;
  latestTransactionId: string | null;
  createdAt: string | null;
  paidAt: string | null;
}

/** Firestore document `paymentTransactions/{orderId}`. */
export interface PaymentTransaction {
  id: string;
  orderId: string;
  fineId: string;
  sessionId: string;
  studentId: string;
  amount: number;
  paymentType: string | null;
  snapToken: string | null;
  redirectUrl: string | null;
  status: PaymentTransactionStatus;
  midtransTransactionStatus: string | null;
  paidAt: string | null;
  createdAt: string | null;
  updatedAt: string | null;
}

/** Response from `POST /api/payments/create`. */
export interface PaymentCheckout {
  orderId: string;
  snapToken: string;
  redirectUrl: string;
}
