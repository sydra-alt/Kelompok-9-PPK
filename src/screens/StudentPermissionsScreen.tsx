import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';

import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { LoadingState } from '@/components/LoadingState';
import { AiCategoryChip, PermissionStatusBadge } from '@/components/PermissionStatusBadge';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useStudentData } from '@/context/StudentDataContext';
import { navigateTo } from '@/navigation/AppNavigator';
import { classifyPermissionRequest } from '@/services/permission-service';
import type { PermissionRequest, PermissionStatus } from '@/types';
import { formatDate, formatDateTime } from '@/utils/format';

type Filter = 'all' | PermissionStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

/**
 * Daftar pengajuan izin praktikan & status keputusan real-time (PIC: Programmer 1).
 */
export default function StudentPermissionsScreen() {
  const { profile } = useAuth();
  const { permissionRequests, loading, error, fromCache, isOffline, retry } = useStudentData();
  const [filter, setFilter] = useState<Filter>('all');
  const [retryingAiId, setRetryingAiId] = useState<string | null>(null);

  const filtered = useMemo(
    () =>
      filter === 'all'
        ? permissionRequests
        : permissionRequests.filter((item) => item.status === filter),
    [permissionRequests, filter],
  );

  if (loading && permissionRequests.length === 0) {
    return (
      <LoadingState
        title="Memuat daftar pengajuan izin..."
        message="Menyinkronkan status pengajuan izin dari Firestore."
      />
    );
  }

  if (error && permissionRequests.length === 0) {
    return (
      <EmptyState
        icon="⚠️"
        title="Gagal memuat pengajuan izin"
        message={error}
        actionLabel="Coba Lagi"
        onAction={retry}
      />
    );
  }

  const pendingCount = permissionRequests.filter((r) => r.status === 'pending').length;
  const approvedCount = permissionRequests.filter((r) => r.status === 'approved').length;
  const rejectedCount = permissionRequests.filter((r) => r.status === 'rejected').length;

  const handleRetryAi = async (item: PermissionRequest) => {
    setRetryingAiId(item.id);
    try {
      await classifyPermissionRequest(item.id, item.reason);
    } finally {
      setRetryingAiId(null);
    }
  };

  return (
    <FlatList
      data={filtered}
      keyExtractor={(item) => item.id}
      contentContainerStyle={styles.listContent}
      ItemSeparatorComponent={() => <View style={styles.separator} />}
      ListHeaderComponent={
        <View style={styles.header}>
          <ConnectionBanner
            isOffline={isOffline}
            fromCache={fromCache}
            error={error}
            onRetry={retry}
          />

          <View style={styles.summaryCard}>
            <Text style={styles.summaryTitle}>Status Pengajuan Izin</Text>
            <Text style={styles.summarySubtitle}>
              Perubahan keputusan oleh asisten akan langsung tampil secara real-time.
            </Text>
            <View style={styles.summaryRow}>
              <SummaryCell value={pendingCount} label="Menunggu" color={AppColors.warning} />
              <SummaryCell value={approvedCount} label="Disetujui" color={AppColors.success} />
              <SummaryCell value={rejectedCount} label="Ditolak" color={AppColors.danger} />
            </View>
          </View>

          <View style={styles.filterRow}>
            {FILTERS.map((item) => {
              const active = filter === item.value;
              return (
                <Pressable
                  key={item.value}
                  testID={`permission-filter-${item.value}`}
                  onPress={() => setFilter(item.value)}
                  accessibilityRole="tab"
                  accessibilityState={{ selected: active }}
                  style={[styles.filterChip, active && styles.filterChipActive]}>
                  <Text style={[styles.filterText, active && styles.filterTextActive]}>
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>
      }
      renderItem={({ item }) => (
        <PermissionRequestCard
          item={item}
          retryingAi={retryingAiId === item.id}
          onRetryAi={() => void handleRetryAi(item)}
          onOpenSession={() =>
            navigateTo.studentSessionDetail(profile?.uid ?? item.studentId, item.sessionId)
          }
        />
      )}
      ListEmptyComponent={
        permissionRequests.length === 0 ? (
          <EmptyState
            icon="📝"
            title="Belum ada pengajuan izin"
            message="Kamu dapat mengajukan izin melalui halaman Detail Sesi pada jadwal praktikum yang berhalangan dihadiri."
            actionLabel="Kembali ke Beranda"
            onAction={() => router.back()}
          />
        ) : (
          <EmptyState
            icon="🔎"
            title="Tidak ada pengajuan"
            message="Tidak ada pengajuan izin dengan status ini."
            actionLabel="Tampilkan Semua"
            onAction={() => setFilter('all')}
          />
        )
      }
    />
  );
}

function SummaryCell({ value, label, color }: { value: number; label: string; color: string }) {
  return (
    <View style={styles.summaryCell}>
      <Text style={[styles.summaryValue, { color }]}>{value}</Text>
      <Text style={styles.summaryLabel}>{label}</Text>
    </View>
  );
}

function PermissionRequestCard({
  item,
  retryingAi,
  onRetryAi,
  onOpenSession,
}: {
  item: PermissionRequest;
  retryingAi: boolean;
  onRetryAi: () => void;
  onOpenSession: () => void;
}) {
  return (
    <Pressable
      testID={`permission-item-${item.id}`}
      onPress={onOpenSession}
      style={({ pressed }) => [styles.card, pressed && styles.pressed]}>
      <View style={styles.cardHeader}>
        <View style={styles.titleBlock}>
          <Text style={styles.practicalName}>{item.practicalName}</Text>
          <Text style={styles.sessionMeta}>
            Kelas {item.className} • {item.sessionDate ? formatDate(item.sessionDate) : '-'}
          </Text>
        </View>
        <PermissionStatusBadge status={item.status} />
      </View>

      <View style={styles.reasonBox}>
        <Text style={styles.reasonLabel}>Alasan Izin:</Text>
        <Text style={styles.reasonText}>{item.reason}</Text>
      </View>

      <View style={styles.aiRow}>
        <AiCategoryChip classification={item.aiClassification} />
        {item.aiClassification.status === 'failed' ? (
          <Pressable
            testID={`retry-ai-${item.id}`}
            disabled={retryingAi}
            onPress={onRetryAi}
            style={styles.retryAiButton}>
            <Text style={styles.retryAiText}>
              {retryingAi ? 'Memproses...' : 'Coba Klasifikasi Ulang'}
            </Text>
          </Pressable>
        ) : null}
      </View>

      {item.status !== 'pending' ? (
        <View
          style={[
            styles.decisionBox,
            item.status === 'approved' ? styles.decisionApproved : styles.decisionRejected,
          ]}>
          <Text style={styles.decisionTitle}>
            {item.status === 'approved' ? 'Disetujui' : 'Ditolak'}
            {item.decidedByName ? ` oleh ${item.decidedByName}` : ''}
            {item.decidedAt ? ` • ${formatDateTime(item.decidedAt)}` : ''}
          </Text>
          {item.decisionNote ? (
            <Text style={styles.decisionNote}>Catatan asisten: {item.decisionNote}</Text>
          ) : null}
        </View>
      ) : null}

      {item.createdAt ? (
        <Text style={styles.timestamp}>Diajukan {formatDateTime(item.createdAt)}</Text>
      ) : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  listContent: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
    marginBottom: Spacing.three,
  },
  separator: {
    height: Spacing.three,
  },
  summaryCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.two + 2,
    ...CardShadow,
  },
  summaryTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.text,
  },
  summarySubtitle: {
    fontSize: 13,
    color: AppColors.textMuted,
    marginTop: -4,
  },
  summaryRow: {
    flexDirection: 'row',
    gap: Spacing.two,
    marginTop: Spacing.one,
  },
  summaryCell: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: Spacing.two + 2,
    borderRadius: Radius.md,
    backgroundColor: AppColors.background,
  },
  summaryValue: {
    fontSize: 22,
    fontWeight: '800',
  },
  summaryLabel: {
    fontSize: 12,
    fontWeight: '600',
    color: AppColors.textMuted,
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  filterChip: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  filterChipActive: {
    backgroundColor: AppColors.primary,
    borderColor: AppColors.primary,
  },
  filterText: {
    fontSize: 13,
    fontWeight: '600',
    color: AppColors.neutral,
  },
  filterTextActive: {
    color: AppColors.textOnPrimary,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.two + 4,
    ...CardShadow,
  },
  pressed: {
    opacity: 0.9,
  },
  cardHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  titleBlock: {
    flex: 1,
    gap: 2,
  },
  practicalName: {
    fontSize: 16,
    fontWeight: '800',
    color: AppColors.text,
  },
  sessionMeta: {
    fontSize: 12,
    color: AppColors.textMuted,
  },
  reasonBox: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textMuted,
    textTransform: 'uppercase',
  },
  reasonText: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.text,
  },
  aiRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: Spacing.two,
  },
  retryAiButton: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    borderColor: AppColors.primary,
  },
  retryAiText: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.primary,
  },
  decisionBox: {
    borderRadius: Radius.md,
    padding: Spacing.two + 4,
    gap: 2,
  },
  decisionApproved: {
    backgroundColor: AppColors.successSoft,
  },
  decisionRejected: {
    backgroundColor: AppColors.dangerSoft,
  },
  decisionTitle: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  decisionNote: {
    fontSize: 12,
    color: AppColors.text,
  },
  timestamp: {
    fontSize: 11,
    color: AppColors.textMuted,
  },
});

