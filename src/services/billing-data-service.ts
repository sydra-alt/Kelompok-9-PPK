import { Timestamp, collection, onSnapshot, query, where, type Unsubscribe } from 'firebase/firestore';

import { getDb } from '@/services/firebase';
import type {
  FineRecord,
  FineStatus,
  PaymentTransaction,
  PaymentTransactionStatus,
} from '@/types/payments';

// Collection names follow the data contract documented in the README.
const FINES_COLLECTION = 'fines';
const PAYMENTS_COLLECTION = 'paymentTransactions';

export interface BillingSnapshotMeta {
  fromCache: boolean;
}

export type BillingOnData<T> = (items: T[], meta: BillingSnapshotMeta) => void;
export type BillingOnError = (error: unknown) => void;

function asString(value: unknown): string {
  return typeof value === 'string' ? value : '';
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : 0;
}

function toLocalDateTime(value: unknown): string | null {
  const date = value instanceof Timestamp ? value.toDate() : value instanceof Date ? value : null;
  if (!date || Number.isNaN(date.getTime())) return null;

  const parts = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Asia/Jakarta',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(date);
  const part = (type: Intl.DateTimeFormatPartTypes) =>
    parts.find((item) => item.type === type)?.value ?? '00';

  return `${part('year')}-${part('month')}-${part('day')}T${part('hour')}:${part('minute')}:${part('second')}`;
}

function toFine(docId: string, data: Record<string, unknown>): FineRecord | null {
  const status = data.status;
  if ((status !== 'pending' && status !== 'paid') || typeof data.studentId !== 'string') return null;

  return {
    id: docId,
    studentId: data.studentId,
    studentName: asString(data.studentName),
    studentIdentifier: asString(data.studentIdentifier),
    sessionId: asString(data.sessionId),
    classId: asString(data.classId),
    labId: asString(data.labId),
    attendanceId: asString(data.attendanceId),
    practicalName: asString(data.practicalName) || 'Denda praktikum',
    sessionDate: asString(data.sessionDate),
    amount: asNumber(data.amount),
    lateMinutes: asNumber(data.lateMinutes),
    status: status as FineStatus,
    latestTransactionId: asNullableString(data.latestTransactionId),
    createdAt: toLocalDateTime(data.createdAt),
    paidAt: toLocalDateTime(data.paidAt),
  };
}

function toPaymentTransaction(
  docId: string,
  data: Record<string, unknown>,
): PaymentTransaction | null {
  const status = data.status;
  if (
    (status !== 'pending' && status !== 'success' && status !== 'failed') ||
    typeof data.studentId !== 'string'
  ) {
    return null;
  }

  return {
    id: docId,
    orderId: asString(data.orderId) || docId,
    fineId: asString(data.fineId),
    sessionId: asString(data.sessionId),
    studentId: data.studentId,
    amount: asNumber(data.amount),
    paymentType: asNullableString(data.paymentType),
    snapToken: asNullableString(data.snapToken),
    redirectUrl: asNullableString(data.redirectUrl),
    status: status as PaymentTransactionStatus,
    midtransTransactionStatus: asNullableString(data.midtransTransactionStatus),
    paidAt: toLocalDateTime(data.paidAt),
    createdAt: toLocalDateTime(data.createdAt),
    updatedAt: toLocalDateTime(data.updatedAt),
  };
}

/** Realtime fines belonging to one authenticated student. */
export function subscribeStudentFines(
  studentId: string,
  onData: BillingOnData<FineRecord>,
  onError: BillingOnError,
): Unsubscribe {
  const studentQuery = query(
    collection(getDb(), FINES_COLLECTION),
    where('studentId', '==', studentId),
  );

  return onSnapshot(
    studentQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => toFine(item.id, item.data()))
        .filter((item): item is FineRecord => item !== null)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      onData(items, { fromCache: snapshot.metadata.fromCache });
    },
    onError,
  );
}

/** Realtime payment history belonging to one authenticated student. */
export function subscribeStudentPaymentTransactions(
  studentId: string,
  onData: BillingOnData<PaymentTransaction>,
  onError: BillingOnError,
): Unsubscribe {
  const studentQuery = query(
    collection(getDb(), PAYMENTS_COLLECTION),
    where('studentId', '==', studentId),
  );

  return onSnapshot(
    studentQuery,
    { includeMetadataChanges: true },
    (snapshot) => {
      const items = snapshot.docs
        .map((item) => toPaymentTransaction(item.id, item.data()))
        .filter((item): item is PaymentTransaction => item !== null)
        .sort((a, b) => (b.createdAt ?? '').localeCompare(a.createdAt ?? ''));
      onData(items, { fromCache: snapshot.metadata.fromCache });
    },
    onError,
  );
}
