import { useState } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import * as WebBrowser from 'expo-web-browser';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentBillingData } from '@/hooks/use-student-billing-data';
import { navigateTo } from '@/navigation/AppNavigator';
import { AppError, getErrorMessage } from '@/services/errors';
import { createFineCheckout, isBackendApiConfigured } from '@/services/attendance-payment-api-service';
import type { FineRecord } from '@/types/payments';
import { formatDate, formatDateTime } from '@/utils/format';

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

function isSecurePaymentUrl(value: string): boolean {
  try {
    return new URL(value).protocol === 'https:';
  } catch {
    return false;
  }
}

export default function StudentFinesScreen() {
  const { profile } = useAuth();
  const studentId = profile?.role === 'praktikan' ? profile.uid : undefined;
  const { fines, loading, error, fromCache, isOffline, retry } = useStudentBillingData(studentId);
  const [payingFineId, setPayingFineId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  if (!studentId) {
    return (
      <EmptyState
        icon="🔒"
        title="Akses Praktikan Diperlukan"
        message="Masuk dengan akun praktikan untuk melihat tagihan denda."
        actionLabel="Kembali"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if (loading && fines.length === 0) {
    return <LoadingState title="Memuat tagihan..." message="Mengambil data denda milik akunmu." />;
  }

  if (error && fines.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Tagihan belum dapat dimuat"
        message={error}
        actionLabel="Coba Lagi"
        onAction={retry}
      />
    );
  }

  const pendingFines = fines.filter((fine) => fine.status === 'pending');
  const pendingTotal = pendingFines.reduce((total, fine) => total + fine.amount, 0);

  const handleCheckout = async (fine: FineRecord) => {
    if (payingFineId) return;
    if (!isBackendApiConfigured()) {
      setFeedback({ type: 'info', message: 'Checkout belum tersedia sampai backend pembayaran dikonfigurasi.' });
      return;
    }

    setPayingFineId(fine.id);
    setFeedback(null);
    try {
      const checkout = await createFineCheckout(fine.id);
      if (!isSecurePaymentUrl(checkout.redirectUrl)) {
        throw new AppError('invalid-payment-url', 'Backend mengembalikan URL checkout yang tidak aman.');
      }
      await WebBrowser.openBrowserAsync(checkout.redirectUrl);
      setFeedback({
        type: 'info',
        message: 'Checkout ditutup. Status tagihan akan berubah setelah backend menerima dan memverifikasi webhook pembayaran.',
      });
    } catch (cause) {
      setFeedback({ type: 'error', message: getErrorMessage(cause, 'Checkout gagal dibuka. Coba lagi.') });
    } finally {
      setPayingFineId(null);
    }
  };

  return (
    <FlatList
      data={fines}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ConnectionBanner isOffline={isOffline} fromCache={fromCache} error={error} onRetry={retry} />
          {feedback ? (
            <FeedbackBanner
              type={feedback.type}
              title={feedback.type === 'error' ? 'Checkout gagal' : feedback.type === 'success' ? 'Berhasil' : 'Informasi'}
              message={feedback.message}
            />
          ) : null}
          <View style={styles.summaryCard}>
            <Text style={styles.eyebrow}>TAGIHAN PRAKTIKUM</Text>
            <Text style={styles.summaryAmount}>{formatRupiah(pendingTotal)}</Text>
            <Text style={styles.summaryCaption}>
              {pendingFines.length} tagihan belum dibayar • Status diperbarui dari backend.
            </Text>
          </View>
          {!isBackendApiConfigured() ? (
            <FeedbackBanner
              type="info"
              title="Checkout belum dikonfigurasi"
              message="Daftar tagihan dapat ditampilkan setelah Rules dan backend tersedia. Tombol pembayaran aktif setelah EXPO_PUBLIC_PAYMENT_API_URL diatur."
            />
          ) : null}
          <AppButton
            title="Riwayat Pembayaran"
            variant="secondary"
            onPress={navigateTo.studentPayments}
          />
          <Text style={styles.sectionTitle}>Semua Tagihan</Text>
        </View>
      }
      renderItem={({ item }) => <FineCard fine={item} busy={payingFineId === item.id} onPay={() => void handleCheckout(item)} />}
      ListEmptyComponent={
        <EmptyState
          icon="✅"
          title="Tidak ada tagihan"
          message="Tagihan denda yang dibuat backend akan muncul di halaman ini."
          actionLabel="Muat Ulang"
          onAction={retry}
        />
      }
    />
  );
}

function FineCard({ fine, busy, onPay }: { fine: FineRecord; busy: boolean; onPay: () => void }) {
  const isPending = fine.status === 'pending';
  return (
    <View style={styles.fineCard}>
      <View style={styles.cardTopRow}>
        <View style={styles.cardHeading}>
          <Text style={styles.fineTitle}>{fine.practicalName}</Text>
          <Text style={styles.mutedText}>{fine.classId || 'Sesi praktikum'}</Text>
        </View>
        <View style={[styles.statusBadge, isPending ? styles.pendingBadge : styles.paidBadge]}>
          <Text style={[styles.statusText, { color: isPending ? AppColors.warning : AppColors.success }]}>
            {isPending ? 'Belum dibayar' : 'Lunas'}
          </Text>
        </View>
      </View>
      <View style={styles.details}>
        <Detail label="Tanggal sesi" value={fine.sessionDate ? formatDate(fine.sessionDate) : '—'} />
        <Detail label="Keterlambatan" value={`${fine.lateMinutes} menit`} />
        <Detail label="Dibuat" value={fine.createdAt ? formatDateTime(fine.createdAt) : '—'} />
      </View>
      <View style={styles.cardBottomRow}>
        <Text style={styles.amount}>{formatRupiah(fine.amount)}</Text>
        {isPending ? (
          <AppButton
            title={busy ? 'Membuka...' : 'Bayar'}
            disabled={busy}
            onPress={onPay}
            style={styles.payButton}
          />
        ) : fine.paidAt ? (
          <Text style={styles.paidAt}>Dibayar {formatDateTime(fine.paidAt)}</Text>
        ) : null}
      </View>
    </View>
  );
}

function Detail({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  summaryCard: { backgroundColor: AppColors.primary, borderRadius: Radius.xl, padding: Spacing.four, gap: Spacing.two, ...CardShadow },
  eyebrow: { color: 'rgba(255,255,255,0.75)', fontSize: 11, fontWeight: '800', letterSpacing: 1 },
  summaryAmount: { color: AppColors.textOnPrimary, fontSize: 28, fontWeight: '800' },
  summaryCaption: { color: 'rgba(255,255,255,0.88)', fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  fineCard: { backgroundColor: AppColors.surface, padding: Spacing.four, borderRadius: Radius.lg, borderWidth: 1, borderColor: AppColors.border, gap: Spacing.three, ...CardShadow },
  cardTopRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  cardHeading: { flex: 1, gap: 4 },
  fineTitle: { color: AppColors.text, fontSize: 16, fontWeight: '800' },
  mutedText: { color: AppColors.textMuted, fontSize: 12 },
  statusBadge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  pendingBadge: { backgroundColor: AppColors.warningSoft },
  paidBadge: { backgroundColor: AppColors.successSoft },
  statusText: { fontSize: 11, fontWeight: '800' },
  details: { borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: Spacing.two, gap: Spacing.two },
  detailRow: { flexDirection: 'row', justifyContent: 'space-between', gap: Spacing.two },
  detailLabel: { color: AppColors.textMuted, fontSize: 12 },
  detailValue: { color: AppColors.text, fontSize: 12, fontWeight: '600', textAlign: 'right', flexShrink: 1 },
  cardBottomRow: { borderTopWidth: 1, borderTopColor: AppColors.border, paddingTop: Spacing.three, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: Spacing.two },
  amount: { color: AppColors.text, fontSize: 18, fontWeight: '800', flexShrink: 1 },
  payButton: { minWidth: 112 },
  paidAt: { color: AppColors.success, fontSize: 11, fontWeight: '600', flexShrink: 1, textAlign: 'right' },
  separator: { height: Spacing.three },
});
