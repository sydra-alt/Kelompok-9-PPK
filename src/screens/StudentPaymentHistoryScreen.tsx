import { FlatList, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentBillingData } from '@/hooks/use-student-billing-data';
import { navigateTo } from '@/navigation/AppNavigator';
import type { PaymentTransaction } from '@/types/payments';
import { formatDateTime } from '@/utils/format';

const formatRupiah = (amount: number) =>
  new Intl.NumberFormat('id-ID', {
    style: 'currency',
    currency: 'IDR',
    maximumFractionDigits: 0,
  }).format(amount);

const STATUS_LABELS: Record<PaymentTransaction['status'], string> = {
  pending: 'Menunggu pembayaran',
  success: 'Berhasil',
  failed: 'Gagal',
};

const STATUS_COLORS: Record<PaymentTransaction['status'], { color: string; background: string }> = {
  pending: { color: AppColors.warning, background: AppColors.warningSoft },
  success: { color: AppColors.success, background: AppColors.successSoft },
  failed: { color: AppColors.danger, background: AppColors.dangerSoft },
};

export default function StudentPaymentHistoryScreen() {
  const { profile } = useAuth();
  const studentId = profile?.role === 'praktikan' ? profile.uid : undefined;
  const { transactions, loading, error, fromCache, isOffline, retry } = useStudentBillingData(studentId);

  if (!studentId) {
    return (
      <EmptyState
        icon="🔒"
        title="Akses Praktikan Diperlukan"
        message="Masuk dengan akun praktikan untuk melihat riwayat pembayaran."
        actionLabel="Kembali"
        onAction={navigateTo.roleSelection}
      />
    );
  }

  if (loading && transactions.length === 0) {
    return <LoadingState title="Memuat riwayat pembayaran..." message="Mengambil transaksi milik akunmu." />;
  }

  if (error && transactions.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Riwayat belum dapat dimuat"
        message={error}
        actionLabel="Coba Lagi"
        onAction={retry}
      />
    );
  }

  return (
    <FlatList
      data={transactions}
      keyExtractor={(item) => item.orderId}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ConnectionBanner isOffline={isOffline} fromCache={fromCache} error={error} onRetry={retry} />
          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Riwayat Pembayaran</Text>
            <Text style={styles.summaryText}>
              Status transaksi disinkronkan dari Firestore setelah diverifikasi backend. Menutup halaman checkout tidak berarti pembayaran berhasil.
            </Text>
          </View>
          <AppButton title="Kembali ke Tagihan" variant="secondary" onPress={navigateTo.studentFines} />
          <Text style={styles.sectionTitle}>Semua Transaksi</Text>
        </View>
      }
      renderItem={({ item }) => <TransactionCard transaction={item} />}
      ListEmptyComponent={
        <EmptyState
          icon="🧾"
          title="Belum ada transaksi"
          message="Riwayat akan muncul setelah kamu memulai checkout tagihan."
          actionLabel="Lihat Tagihan"
          onAction={navigateTo.studentFines}
        />
      }
    />
  );
}

function TransactionCard({ transaction }: { transaction: PaymentTransaction }) {
  const status = STATUS_COLORS[transaction.status];
  return (
    <View style={styles.transactionCard}>
      <View style={styles.topRow}>
        <View style={styles.transactionHeading}>
          <Text style={styles.transactionTitle}>{transaction.sessionId || 'Pembayaran denda'}</Text>
          <Text style={styles.transactionMeta}>Order {transaction.orderId}</Text>
        </View>
        <View style={[styles.badge, { backgroundColor: status.background }]}>
          <Text style={[styles.badgeText, { color: status.color }]}>{STATUS_LABELS[transaction.status]}</Text>
        </View>
      </View>
      <View style={styles.bottomRow}>
        <View>
          <Text style={styles.amount}>{formatRupiah(transaction.amount)}</Text>
          <Text style={styles.date}>{transaction.createdAt ? formatDateTime(transaction.createdAt) : 'Waktu transaksi belum tersedia'}</Text>
        </View>
        {transaction.paymentType ? <Text style={styles.paymentType}>{transaction.paymentType}</Text> : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  listContent: { width: '100%', maxWidth: 720, alignSelf: 'center', padding: Spacing.three, paddingBottom: Spacing.six },
  header: { gap: Spacing.three, marginBottom: Spacing.three },
  summaryCard: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, padding: Spacing.four, borderWidth: 1, borderColor: AppColors.border, gap: Spacing.two, ...CardShadow },
  summaryTitle: { color: AppColors.text, fontSize: 19, fontWeight: '800' },
  summaryText: { color: AppColors.textMuted, fontSize: 13, lineHeight: 19 },
  sectionTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  transactionCard: { backgroundColor: AppColors.surface, borderRadius: Radius.lg, padding: Spacing.four, borderWidth: 1, borderColor: AppColors.border, gap: Spacing.three, ...CardShadow },
  topRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.two },
  transactionHeading: { flex: 1, gap: 4 },
  transactionTitle: { color: AppColors.text, fontSize: 15, fontWeight: '800' },
  transactionMeta: { color: AppColors.textMuted, fontSize: 11 },
  badge: { borderRadius: Radius.pill, paddingHorizontal: 10, paddingVertical: 6 },
  badgeText: { fontSize: 11, fontWeight: '800' },
  bottomRow: { paddingTop: Spacing.two, borderTopWidth: 1, borderTopColor: AppColors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', gap: Spacing.two },
  amount: { color: AppColors.text, fontSize: 17, fontWeight: '800' },
  date: { color: AppColors.textMuted, fontSize: 11, marginTop: 4 },
  paymentType: { color: AppColors.primaryDark, fontSize: 11, fontWeight: '700' },
  separator: { height: Spacing.three },
});
