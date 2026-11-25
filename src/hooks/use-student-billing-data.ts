import { useCallback, useEffect, useState } from 'react';

import { useNetworkStatus } from '@/hooks/use-network-status';
import { getErrorMessage } from '@/services/errors';
import {
  subscribeStudentFines,
  subscribeStudentPaymentTransactions,
  type BillingSnapshotMeta,
} from '@/services/sprint4-data-service';
import type { FineRecord, PaymentTransaction } from '@/types/sprint4';

interface UseStudentBillingDataResult {
  fines: FineRecord[];
  transactions: PaymentTransaction[];
  loading: boolean;
  error: string | null;
  fromCache: boolean;
  isOffline: boolean;
  retry: () => void;
}

export function useStudentBillingData(studentId?: string): UseStudentBillingDataResult {
  const { isOffline } = useNetworkStatus();
  const [retryKey, setRetryKey] = useState(0);
  const scopeKey = studentId ? `${studentId}:${retryKey}` : null;
  const [snapshotState, setSnapshotState] = useState<{
    scopeKey: string | null;
    fines: FineRecord[];
    transactions: PaymentTransaction[];
    finesReady: boolean;
    transactionsReady: boolean;
    finesFromCache: boolean;
    transactionsFromCache: boolean;
    loading: boolean;
    error: string | null;
  }>({
    scopeKey: null,
    fines: [],
    transactions: [],
    finesReady: false,
    transactionsReady: false,
    finesFromCache: false,
    transactionsFromCache: false,
    loading: true,
    error: null,
  });

  useEffect(() => {
    if (!studentId || !scopeKey) return undefined;

    let finesReady = false;
    let transactionsReady = false;
    let active = true;
    let finesFromCache = false;
    let transactionsFromCache = false;

    const onSnapshotMeta = (meta: BillingSnapshotMeta, kind: 'fines' | 'transactions') => {
      if (!active) return;
      if (kind === 'fines') {
        finesReady = true;
        finesFromCache = meta.fromCache;
      } else {
        transactionsReady = true;
        transactionsFromCache = meta.fromCache;
      }
      setSnapshotState((previous) => {
        const current = previous.scopeKey === scopeKey ? previous : {
          scopeKey,
          fines: [],
          transactions: [],
          finesReady: false,
          transactionsReady: false,
          finesFromCache: false,
          transactionsFromCache: false,
          loading: true,
          error: null,
        };
        return {
          ...current,
          finesReady,
          transactionsReady,
          finesFromCache,
          transactionsFromCache,
          loading: !(finesReady && transactionsReady),
        };
      });
    };

    const onError = (cause: unknown) => {
      if (!active) return;
      setSnapshotState((previous) => {
        const current = previous.scopeKey === scopeKey ? previous : {
          scopeKey,
          fines: [],
          transactions: [],
          finesReady: false,
          transactionsReady: false,
          finesFromCache: false,
          transactionsFromCache: false,
          loading: true,
          error: null,
        };
        return {
          ...current,
          loading: false,
          error: getErrorMessage(cause, 'Gagal memuat tagihan dan riwayat pembayaran.'),
        };
      });
    };

    const unsubscribeFines = subscribeStudentFines(
      studentId,
      (items, meta) => {
        if (!active) return;
        onSnapshotMeta(meta, 'fines');
        setSnapshotState((previous) => ({
          ...(previous.scopeKey === scopeKey ? previous : {
            scopeKey,
            fines: [],
            transactions: [],
            finesReady: false,
            transactionsReady: false,
            finesFromCache: false,
            transactionsFromCache: false,
            loading: true,
            error: null,
          }),
          fines: items,
        }));
      },
      onError,
    );
    const unsubscribeTransactions = subscribeStudentPaymentTransactions(
      studentId,
      (items, meta) => {
        if (!active) return;
        onSnapshotMeta(meta, 'transactions');
        setSnapshotState((previous) => ({
          ...(previous.scopeKey === scopeKey ? previous : {
            scopeKey,
            fines: [],
            transactions: [],
            finesReady: false,
            transactionsReady: false,
            finesFromCache: false,
            transactionsFromCache: false,
            loading: true,
            error: null,
          }),
          transactions: items,
        }));
      },
      onError,
    );

    return () => {
      active = false;
      unsubscribeFines();
      unsubscribeTransactions();
    };
  }, [studentId, scopeKey]);

  const retry = useCallback(() => setRetryKey((value) => value + 1), []);
  const hasCurrentScope = Boolean(scopeKey && snapshotState.scopeKey === scopeKey);

  return {
    fines: hasCurrentScope ? snapshotState.fines : [],
    transactions: hasCurrentScope ? snapshotState.transactions : [],
    loading: Boolean(studentId) && (!hasCurrentScope || snapshotState.loading),
    error: hasCurrentScope ? snapshotState.error : null,
    fromCache: hasCurrentScope && (snapshotState.finesFromCache || snapshotState.transactionsFromCache),
    isOffline,
    retry,
  };
}
