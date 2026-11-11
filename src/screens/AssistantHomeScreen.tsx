import { useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import {
  FlatList,
  Pressable,
  StyleSheet,
  Text,
  View,
} from 'react-native';

import { AppButton } from '@/components/AppButton';
import { ClassFormModal } from '@/components/ClassFormModal';
import { ConfirmActionModal } from '@/components/ConfirmActionModal';
import { ConfirmDeleteModal } from '@/components/ConfirmDeleteModal';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { EmptyState } from '@/components/EmptyState';
import { FeedbackBanner, type FeedbackType } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { MemberFormModal } from '@/components/MemberFormModal';
import { PermissionDecisionModal } from '@/components/PermissionDecisionModal';
import { AiCategoryChip, PermissionStatusBadge } from '@/components/PermissionStatusBadge';
import { SessionCard } from '@/components/SessionCard';
import { SessionFormModal } from '@/components/SessionFormModal';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAssistantData } from '@/context/AssistantDataContext';
import { useAuth } from '@/context/AuthContext';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import type {
  PermissionRequest,
  PermissionStatus,
  PracticeClass,
  PracticeSession,
  SessionStatus,
} from '@/types';
import { formatDate, getInitials } from '@/utils/format';

type Tab = 'sessions' | 'permissions' | 'classes';
type SessionFilter = 'all' | SessionStatus;
type PermissionFilter = 'all' | PermissionStatus;

const SESSION_FILTERS: { value: SessionFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'open', label: 'Dibuka' },
  { value: 'scheduled', label: 'Akan Datang' },
  { value: 'closed', label: 'Selesai' },
];

const PERMISSION_FILTERS: { value: PermissionFilter; label: string }[] = [
  { value: 'all', label: 'Semua' },
  { value: 'pending', label: 'Menunggu' },
  { value: 'approved', label: 'Disetujui' },
  { value: 'rejected', label: 'Ditolak' },
];

interface Feedback {
  type: FeedbackType;
  title: string;
  message: string;
}

export default function AssistantHomeScreen() {
  const { assistantId } = useLocalSearchParams<{ assistantId?: string }>();
  const { profile, logout } = useAuth();
  const dummyAssistant = getUserById(assistantId);

  // Gunakan profil Firebase Auth asisten jika tersedia, atau fallback dummy
  const assistantName = profile?.name ?? dummyAssistant?.name ?? 'Asisten Praktikum';
  const assistantIdentifier = profile?.identifier ?? dummyAssistant?.identifier ?? 'AST-01';
  const assistantEmail = profile?.email ?? 'asisten@kampus.ac.id';

  const {
    classes,
    sessions,
    attendance,
    permissionRequests,
    members,
    loading,
    error,
    fromCache,
    isOffline,
    retry,
    createClass,
    updateClass,
    deleteClass,
    addMember,
    removeMember,
    createSession,
    deleteSession,
    setSessionStatus,
    decidePermission,
  } = useAssistantData();

  const [activeTab, setActiveTab] = useState<Tab>('sessions');
  const [sessionFilter, setSessionFilter] = useState<SessionFilter>('all');
  const [permissionFilter, setPermissionFilter] = useState<PermissionFilter>('all');
  const [feedback, setFeedback] = useState<Feedback | null>(null);

  // Modals state
  const [classModalVisible, setClassModalVisible] = useState(false);
  const [editingClass, setEditingClass] = useState<PracticeClass | null>(null);

  const [sessionModalVisible, setSessionModalVisible] = useState(false);

  const [memberModalVisible, setMemberModalVisible] = useState(false);
  const [targetMemberClass, setTargetMemberClass] = useState<PracticeClass | null>(null);

  const [decisionModalVisible, setDecisionModalVisible] = useState(false);
  const [selectedPermission, setSelectedPermission] = useState<PermissionRequest | null>(null);

  const [deleteModalVisible, setDeleteModalVisible] = useState(false);
  const [deleteConfig, setDeleteConfig] = useState<{
    title: string;
    message: string;
    action: () => Promise<void>;
  } | null>(null);
  const [deleting, setDeleting] = useState(false);

  const [toggleStatusModal, setToggleStatusModal] = useState<{
    session: PracticeSession;
    nextStatus: 'open' | 'closed';
  } | null>(null);

  // Filtered Sessions
  const filteredSessions = useMemo(() => {
    if (sessionFilter === 'all') return sessions;
    return sessions.filter((s) => s.status === sessionFilter);
  }, [sessions, sessionFilter]);

  // Filtered Permissions
  const filteredPermissions = useMemo(() => {
    if (permissionFilter === 'all') return permissionRequests;
    return permissionRequests.filter((p) => p.status === permissionFilter);
  }, [permissionRequests, permissionFilter]);

  // Counts
  const openSessionsCount = sessions.filter((s) => s.status === 'open').length;
  const pendingPermissionsCount = permissionRequests.filter((p) => p.status === 'pending').length;
  const todayKey = new Date().toISOString().slice(0, 10);
  const todaySessionsCount = sessions.filter((s) => s.date === todayKey).length;

  const handleOpenToggleSession = (session: PracticeSession) => {
    if (session.status === 'closed') {
      setFeedback({
        type: 'info',
        title: 'Sesi Sudah Selesai',
        message: 'Sesi yang sudah ditutup tidak dapat dibuka kembali.',
      });
      return;
    }
    const nextStatus = session.status === 'open' ? 'closed' : 'open';
    setToggleStatusModal({ session, nextStatus });
  };

  const handleConfirmToggleSession = async () => {
    if (!toggleStatusModal) return;
    const { session, nextStatus } = toggleStatusModal;
    try {
      await setSessionStatus(session.id, nextStatus);
      setFeedback({
        type: 'success',
        title: 'Status sesi berhasil diperbarui',
        message:
          nextStatus === 'open'
            ? `Sesi ${session.practicalName} (${session.className}) berhasil dibuka. Praktikan dapat melakukan presensi.`
            : `Sesi ${session.practicalName} (${session.className}) berhasil ditutup. Presensi dinonaktifkan.`,
      });
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        title: 'Gagal memperbarui status sesi',
        message: err instanceof Error ? err.message : 'Terjadi kesalahan.',
      });
    } finally {
      setToggleStatusModal(null);
    }
  };

  const handleDeleteItem = (title: string, message: string, action: () => Promise<void>) => {
    setDeleteConfig({ title, message, action });
    setDeleteModalVisible(true);
  };

  const handleConfirmDelete = async () => {
    if (!deleteConfig) return;
    setDeleting(true);
    try {
      await deleteConfig.action();
      setFeedback({
        type: 'success',
        title: 'Berhasil dihapus',
        message: 'Data berhasil dihapus dari server.',
      });
      setDeleteModalVisible(false);
    } catch (err: unknown) {
      setFeedback({
        type: 'error',
        title: 'Gagal menghapus',
        message: err instanceof Error ? err.message : 'Gagal menghapus data.',
      });
    } finally {
      setDeleting(false);
      setDeleteConfig(null);
    }
  };

  if (loading && sessions.length === 0 && classes.length === 0) {
    return (
      <View style={styles.loadingContainer}>
        <LoadingState
          title="Memuat data asisten..."
          message="Menghubungkan ke Firestore dan menyinkronkan data praktikum."
        />
      </View>
    );
  }

  return (
    <View style={styles.root}>
      <FlatList
        data={[]}
        keyExtractor={() => 'dummy'}
        contentContainerStyle={styles.listContent}
        ListHeaderComponent={
          <View style={styles.header}>
            {/* Profil Asisten */}
            <View style={styles.profileCard}>
              <View style={styles.profileRow}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{getInitials(assistantName)}</Text>
                </View>
                <View style={styles.profileInfo}>
                  <Text style={styles.greeting}>Halo, Asisten</Text>
                  <Text style={styles.name}>{assistantName}</Text>
                  <Text style={styles.meta}>
                    {assistantIdentifier} • {assistantEmail}
                  </Text>
                </View>
                <Pressable
                  onPress={() => void logout()}
                  style={styles.logoutButton}
                  accessibilityRole="button"
                  accessibilityLabel="Keluar Akun">
                  <Text style={styles.logoutText}>Keluar</Text>
                </Pressable>
              </View>

              <View style={styles.statsRow}>
                <Stat label="Kelas Diampu" value={classes.length} />
                <Stat label="Hari Ini" value={todaySessionsCount} />
                <Stat label="Sesi Dibuka" value={openSessionsCount} highlight={openSessionsCount > 0} />
                <Stat
                  label="Izin Pending"
                  value={pendingPermissionsCount}
                  highlight={pendingPermissionsCount > 0}
                />
              </View>
            </View>

            {/* Connection Banner & Feedback Banner */}
            <ConnectionBanner
              isOffline={isOffline}
              fromCache={fromCache}
              error={error}
              onRetry={retry}
            />

            {feedback ? (
              <FeedbackBanner
                type={feedback.type}
                title={feedback.title}
                message={feedback.message}
                onClose={() => setFeedback(null)}
              />
            ) : null}

            {/* Tombol Cepat Rekap Presensi */}
            <AppButton
              testID="open-attendance-recap"
              title="📊 Buka Rekap Presensi Real-Time"
              variant="secondary"
              onPress={() => navigateTo.assistantRecap(profile?.uid ?? assistantIdentifier)}
            />

            {/* Tab Navigation */}
            <View style={styles.tabBar}>
              <Pressable
                onPress={() => setActiveTab('sessions')}
                style={[styles.tabItem, activeTab === 'sessions' && styles.tabItemActive]}>
                <Text
                  style={[styles.tabLabel, activeTab === 'sessions' && styles.tabLabelActive]}>
                  Sesi Praktikum ({sessions.length})
                </Text>
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('permissions')}
                style={[styles.tabItem, activeTab === 'permissions' && styles.tabItemActive]}>
                <Text
                  style={[styles.tabLabel, activeTab === 'permissions' && styles.tabLabelActive]}>
                  Keputusan Izin
                </Text>
                {pendingPermissionsCount > 0 ? (
                  <View style={styles.tabBadge}>
                    <Text style={styles.tabBadgeText}>{pendingPermissionsCount}</Text>
                  </View>
                ) : null}
              </Pressable>

              <Pressable
                onPress={() => setActiveTab('classes')}
                style={[styles.tabItem, activeTab === 'classes' && styles.tabItemActive]}>
                <Text
                  style={[styles.tabLabel, activeTab === 'classes' && styles.tabLabelActive]}>
                  Kelas & Peserta ({classes.length})
                </Text>
              </Pressable>
            </View>

            {/* TAB CONTENT: SESI PRAKTIKUM */}
            {activeTab === 'sessions' ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Jadwal Sesi Praktikum</Text>
                    <Text style={styles.sectionSubtitle}>
                      Buka sesi agar praktikan dapat presensi.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => setSessionModalVisible(true)}
                    style={styles.addButton}
                    accessibilityRole="button">
                    <Text style={styles.addButtonText}>+ Sesi Baru</Text>
                  </Pressable>
                </View>

                {/* Filter Sesi */}
                <View style={styles.filterRow}>
                  {SESSION_FILTERS.map((item) => {
                    const active = sessionFilter === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => setSessionFilter(item.value)}
                        style={[styles.filterChip, active && styles.filterChipActive]}>
                        <Text style={[styles.filterText, active && styles.filterTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {filteredSessions.length === 0 ? (
                  <EmptyState
                    icon="🗓️"
                    title="Belum Ada Sesi Praktikum"
                    message="Belum ada sesi praktikum yang dijadwalkan. Klik '+ Sesi Baru' untuk membuat sesi."
                    actionLabel="+ Buat Sesi Baru"
                    onAction={() => setSessionModalVisible(true)}
                  />
                ) : (
                  <View style={styles.sessionList}>
                    {filteredSessions.map((session) => {
                      const presentCount = attendance.filter(
                        (a) => a.sessionId === session.id,
                      ).length;
                      return (
                        <View key={session.id} style={styles.sessionCardWrapper}>
                          <SessionCard
                            session={session}
                            onPress={() =>
                              navigateTo.assistantSession(
                                profile?.uid ?? assistantIdentifier,
                                session.id,
                              )
                            }
                            footer={
                              <View style={styles.sessionCardFooter}>
                                <Text style={styles.attendanceSummary}>
                                  👥 {presentCount} praktikan hadir
                                </Text>
                                <View style={styles.sessionActions}>
                                  <Pressable
                                    onPress={() => handleOpenToggleSession(session)}
                                    style={[
                                      styles.actionPill,
                                      session.status === 'open'
                                        ? styles.actionPillClose
                                        : session.status === 'scheduled'
                                          ? styles.actionPillOpen
                                          : styles.actionPillDisabled,
                                    ]}>
                                    <Text
                                      style={[
                                        styles.actionPillText,
                                        session.status === 'open'
                                          ? styles.actionPillTextClose
                                          : styles.actionPillTextOpen,
                                      ]}>
                                      {session.status === 'open'
                                        ? 'Tutup Sesi'
                                        : session.status === 'scheduled'
                                          ? 'Buka Sesi'
                                          : 'Selesai'}
                                    </Text>
                                  </Pressable>

                                  <Pressable
                                    onPress={() =>
                                      handleDeleteItem(
                                        'Hapus Sesi Praktikum?',
                                        `Apakah Anda yakin ingin menghapus sesi "${session.practicalName} (${session.className})"? Data presensi terkait mungkin terpengaruh.`,
                                        () => deleteSession(session.id),
                                      )
                                    }
                                    style={styles.deleteIconButton}>
                                    <Text style={styles.deleteIconText}>🗑️</Text>
                                  </Pressable>
                                </View>
                              </View>
                            }
                          />
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB CONTENT: KEPUTUSAN IZIN */}
            {activeTab === 'permissions' ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Pengajuan Izin Praktikan</Text>
                    <Text style={styles.sectionSubtitle}>
                      Beri persetujuan atau penolakan izin praktikan.
                    </Text>
                  </View>
                </View>

                {/* Filter Izin */}
                <View style={styles.filterRow}>
                  {PERMISSION_FILTERS.map((item) => {
                    const active = permissionFilter === item.value;
                    return (
                      <Pressable
                        key={item.value}
                        onPress={() => setPermissionFilter(item.value)}
                        style={[styles.filterChip, active && styles.filterChipActive]}>
                        <Text style={[styles.filterText, active && styles.filterTextActive]}>
                          {item.label}
                        </Text>
                      </Pressable>
                    );
                  })}
                </View>

                {filteredPermissions.length === 0 ? (
                  <EmptyState
                    icon="📋"
                    title="Tidak Ada Pengajuan Izin"
                    message="Belum ada permohonan izin praktikan pada filter ini."
                  />
                ) : (
                  <View style={styles.permissionList}>
                    {filteredPermissions.map((req) => (
                      <View key={req.id} style={styles.permissionCard}>
                        <View style={styles.permissionCardHeader}>
                          <View style={styles.permStudentInfo}>
                            <Text style={styles.permStudentName}>{req.studentName}</Text>
                            <Text style={styles.permStudentMeta}>
                              NIM: {req.studentIdentifier} • {req.className}
                            </Text>
                            <Text style={styles.permSessionMeta}>
                              Praktikum: {req.practicalName} ({formatDate(req.sessionDate)})
                            </Text>
                          </View>
                          <PermissionStatusBadge status={req.status} />
                        </View>

                        <View style={styles.reasonBox}>
                          <Text style={styles.reasonLabel}>Alasan:</Text>
                          <Text style={styles.reasonText}>&ldquo;{req.reason}&rdquo;</Text>
                        </View>

                        <View style={styles.aiBox}>
                          <AiCategoryChip classification={req.aiClassification} />
                        </View>

                        {req.decisionNote ? (
                          <View style={styles.noteBox}>
                            <Text style={styles.noteBoxText}>
                              Catatan Keputusan: &ldquo;{req.decisionNote}&rdquo;
                            </Text>
                          </View>
                        ) : null}

                        <View style={styles.permCardFooter}>
                          <Text style={styles.permDateText}>Diajukan: {req.createdAt ?? '-'}</Text>
                          <Pressable
                            onPress={() => {
                              setSelectedPermission(req);
                              setDecisionModalVisible(true);
                            }}
                            style={styles.decideButton}>
                            <Text style={styles.decideButtonText}>
                              {req.status === 'pending' ? 'Beri Keputusan ›' : 'Lihat / Ubah Keputusan ›'}
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ) : null}

            {/* TAB CONTENT: KELAS & PESERTA */}
            {activeTab === 'classes' ? (
              <View style={styles.section}>
                <View style={styles.sectionHeaderRow}>
                  <View>
                    <Text style={styles.sectionTitle}>Kelas & Anggota Praktikum</Text>
                    <Text style={styles.sectionSubtitle}>
                      Kelola daftar kelas dan praktikan terdaftar.
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => {
                      setEditingClass(null);
                      setClassModalVisible(true);
                    }}
                    style={styles.addButton}
                    accessibilityRole="button">
                    <Text style={styles.addButtonText}>+ Kelas Baru</Text>
                  </Pressable>
                </View>

                {classes.length === 0 ? (
                  <EmptyState
                    icon="🏫"
                    title="Belum Ada Kelas"
                    message="Belum ada kelas praktikum yang diampu. Buat kelas baru untuk memulai."
                    actionLabel="+ Tambah Kelas"
                    onAction={() => {
                      setEditingClass(null);
                      setClassModalVisible(true);
                    }}
                  />
                ) : (
                  <View style={styles.classList}>
                    {classes.map((cls) => {
                      const classMembers = members.filter((m) => m.classId === cls.id);
                      return (
                        <View key={cls.id} style={styles.classCard}>
                          <View style={styles.classHeader}>
                            <View style={styles.classTitleBlock}>
                              <Text style={styles.classNameText}>{cls.name}</Text>
                              <Text style={styles.classPracticalText}>{cls.practicalName}</Text>
                            </View>
                            <View style={styles.classActions}>
                              <Pressable
                                onPress={() => {
                                  setEditingClass(cls);
                                  setClassModalVisible(true);
                                }}
                                style={styles.editClassButton}>
                                <Text style={styles.editClassText}>Edit</Text>
                              </Pressable>
                              <Pressable
                                onPress={() =>
                                  handleDeleteItem(
                                    'Hapus Kelas?',
                                    `Apakah Anda yakin ingin menghapus kelas "${cls.name}"? Semua data sesi dan peserta terkait kelas ini mungkin terpengaruh.`,
                                    () => deleteClass(cls.id),
                                  )
                                }
                                style={styles.deleteClassButton}>
                                <Text style={styles.deleteClassText}>Hapus</Text>
                              </Pressable>
                            </View>
                          </View>

                          <View style={styles.memberSection}>
                            <View style={styles.memberHeader}>
                              <Text style={styles.memberCount}>
                                Peserta Terdaftar ({classMembers.length})
                              </Text>
                              <Pressable
                                onPress={() => {
                                  setTargetMemberClass(cls);
                                  setMemberModalVisible(true);
                                }}
                                style={styles.addMemberButton}>
                                <Text style={styles.addMemberText}>+ Tambah Peserta</Text>
                              </Pressable>
                            </View>

                            {classMembers.length === 0 ? (
                              <Text style={styles.emptyMemberText}>
                                Belum ada praktikan di kelas ini.
                              </Text>
                            ) : (
                              <View style={styles.memberList}>
                                {classMembers.map((m) => (
                                  <View key={m.id} style={styles.memberRow}>
                                    <View style={styles.memberInfo}>
                                      <Text style={styles.memberName}>{m.studentName}</Text>
                                      <Text style={styles.memberNim}>
                                        NIM: {m.studentIdentifier}
                                      </Text>
                                    </View>
                                    <Pressable
                                      onPress={() =>
                                        handleDeleteItem(
                                          'Hapus Peserta?',
                                          `Keluarkan "${m.studentName}" dari kelas ${cls.name}?`,
                                          () => removeMember(m.id),
                                        )
                                      }
                                      style={styles.removeMemberButton}>
                                      <Text style={styles.removeMemberText}>✕</Text>
                                    </Pressable>
                                  </View>
                                ))}
                              </View>
                            )}
                          </View>
                        </View>
                      );
                    })}
                  </View>
                )}
              </View>
            ) : null}
          </View>
        }
        renderItem={() => null}
      />

      {/* MODALS */}
      <ClassFormModal
        visible={classModalVisible}
        initialData={editingClass}
        onClose={() => {
          setClassModalVisible(false);
          setEditingClass(null);
        }}
        onSubmit={async (data) => {
          if (editingClass) {
            await updateClass(editingClass.id, data);
            setFeedback({
              type: 'success',
              title: 'Kelas diperbarui',
              message: `Kelas "${data.name}" berhasil diperbarui.`,
            });
          } else {
            await createClass(data);
            setFeedback({
              type: 'success',
              title: 'Kelas dibuat',
              message: `Kelas "${data.name}" berhasil ditambahkan.`,
            });
          }
        }}
      />

      <SessionFormModal
        visible={sessionModalVisible}
        classes={classes}
        defaultAssistantName={assistantName}
        onClose={() => setSessionModalVisible(false)}
        onSubmit={async (data) => {
          await createSession(data);
          setFeedback({
            type: 'success',
            title: 'Sesi praktikum dijadwalkan',
            message: `Sesi ${data.practicalName} (${data.className}) berhasil dibuat.`,
          });
        }}
      />

      <MemberFormModal
        visible={memberModalVisible}
        targetClass={targetMemberClass}
        onClose={() => {
          setMemberModalVisible(false);
          setTargetMemberClass(null);
        }}
        onSubmit={async (data) => {
          await addMember(data);
          setFeedback({
            type: 'success',
            title: 'Peserta ditambahkan',
            message: `${data.studentName} (${data.studentIdentifier}) berhasil ditambahkan ke kelas.`,
          });
        }}
      />

      <PermissionDecisionModal
        visible={decisionModalVisible}
        request={selectedPermission}
        onClose={() => {
          setDecisionModalVisible(false);
          setSelectedPermission(null);
        }}
        onDecide={async (requestId, decision, note) => {
          await decidePermission(requestId, decision, note);
          setFeedback({
            type: 'success',
            title: 'Keputusan izin tersimpan',
            message: `Pengajuan izin berhasil ${decision === 'approved' ? 'disetujui' : 'ditolak'}.`,
          });
        }}
      />

      <ConfirmDeleteModal
        visible={deleteModalVisible}
        title={deleteConfig?.title ?? 'Konfirmasi Hapus'}
        message={deleteConfig?.message ?? 'Tindakan ini tidak dapat dibatalkan.'}
        loading={deleting}
        onCancel={() => {
          setDeleteModalVisible(false);
          setDeleteConfig(null);
        }}
        onConfirm={() => void handleConfirmDelete()}
      />

      {toggleStatusModal ? (
        <ConfirmActionModal
          visible={Boolean(toggleStatusModal)}
          action={toggleStatusModal.nextStatus === 'open' ? 'open' : 'close'}
          sessionName={`${toggleStatusModal.session.practicalName} (${toggleStatusModal.session.className})`}
          onCancel={() => setToggleStatusModal(null)}
          onConfirm={() => void handleConfirmToggleSession()}
        />
      ) : null}
    </View>
  );
}

function Stat({
  label,
  value,
  highlight = false,
}: {
  label: string;
  value: number;
  highlight?: boolean;
}) {
  return (
    <View style={[styles.stat, highlight && styles.statHighlight]}>
      <Text style={[styles.statValue, highlight && styles.statValueHighlight]}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  loadingContainer: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  listContent: {
    width: '100%',
    maxWidth: 760,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
  },
  header: {
    gap: Spacing.three,
  },
  profileCard: {
    backgroundColor: AppColors.primary,
    borderRadius: Radius.xl,
    padding: Spacing.four,
    gap: Spacing.four,
  },
  profileRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    color: AppColors.textOnPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  profileInfo: {
    flex: 1,
  },
  greeting: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 12,
  },
  name: {
    color: AppColors.textOnPrimary,
    fontSize: 18,
    fontWeight: '800',
  },
  meta: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 12,
    marginTop: 2,
  },
  logoutButton: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
    backgroundColor: 'rgba(255,255,255,0.18)',
  },
  logoutText: {
    color: AppColors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  statsRow: {
    flexDirection: 'row',
    gap: Spacing.two,
  },
  stat: {
    flex: 1,
    backgroundColor: 'rgba(255,255,255,0.16)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.two + 4,
    alignItems: 'center',
  },
  statHighlight: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  statValue: {
    color: AppColors.textOnPrimary,
    fontSize: 20,
    fontWeight: '800',
  },
  statValueHighlight: {
    color: '#FEF08A',
  },
  statLabel: {
    color: 'rgba(255,255,255,0.85)',
    fontSize: 10,
    fontWeight: '600',
    marginTop: 2,
    textAlign: 'center',
  },
  tabBar: {
    flexDirection: 'row',
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    padding: 4,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  tabItem: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    borderRadius: Radius.md,
    gap: 4,
  },
  tabItemActive: {
    backgroundColor: AppColors.primary,
  },
  tabLabel: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
  },
  tabLabelActive: {
    color: AppColors.textOnPrimary,
  },
  tabBadge: {
    backgroundColor: AppColors.danger,
    borderRadius: Radius.pill,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  tabBadgeText: {
    color: AppColors.textOnPrimary,
    fontSize: 10,
    fontWeight: '800',
  },
  section: {
    gap: Spacing.three,
    marginTop: Spacing.two,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  sectionTitle: {
    color: AppColors.text,
    fontSize: 17,
    fontWeight: '800',
  },
  sectionSubtitle: {
    color: AppColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  addButton: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: Radius.md,
    backgroundColor: AppColors.primary,
  },
  addButtonText: {
    color: AppColors.textOnPrimary,
    fontSize: 12,
    fontWeight: '700',
  },
  filterRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.one + 2,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
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
    color: AppColors.neutral,
    fontSize: 12,
    fontWeight: '600',
  },
  filterTextActive: {
    color: AppColors.textOnPrimary,
  },
  sessionList: {
    gap: Spacing.two + 4,
  },
  sessionCardWrapper: {
    position: 'relative',
  },
  sessionCardFooter: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.two,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  attendanceSummary: {
    color: AppColors.textMuted,
    fontSize: 12,
    fontWeight: '600',
  },
  sessionActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  actionPill: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.pill,
  },
  actionPillOpen: {
    backgroundColor: AppColors.successSoft,
  },
  actionPillClose: {
    backgroundColor: AppColors.dangerSoft,
  },
  actionPillDisabled: {
    backgroundColor: AppColors.neutralSoft,
  },
  actionPillText: {
    fontSize: 11,
    fontWeight: '700',
  },
  actionPillTextOpen: {
    color: AppColors.success,
  },
  actionPillTextClose: {
    color: AppColors.danger,
  },
  deleteIconButton: {
    padding: 6,
  },
  deleteIconText: {
    fontSize: 15,
  },
  permissionList: {
    gap: Spacing.three,
  },
  permissionCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.three + 2,
    gap: Spacing.two,
    ...CardShadow,
  },
  permissionCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    gap: Spacing.two,
  },
  permStudentInfo: {
    flex: 1,
  },
  permStudentName: {
    color: AppColors.text,
    fontSize: 15,
    fontWeight: '800',
  },
  permStudentMeta: {
    color: AppColors.textMuted,
    fontSize: 12,
    marginTop: 2,
  },
  permSessionMeta: {
    color: AppColors.primary,
    fontSize: 12,
    fontWeight: '600',
    marginTop: 2,
  },
  reasonBox: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.two + 2,
  },
  reasonLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: AppColors.textMuted,
  },
  reasonText: {
    fontSize: 13,
    color: AppColors.text,
    fontStyle: 'italic',
    marginTop: 2,
  },
  aiBox: {
    alignSelf: 'flex-start',
  },
  noteBox: {
    backgroundColor: AppColors.warningSoft,
    padding: Spacing.two,
    borderRadius: Radius.md,
  },
  noteBoxText: {
    fontSize: 11,
    color: AppColors.warning,
    fontWeight: '600',
  },
  permCardFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.two,
    marginTop: 2,
  },
  permDateText: {
    fontSize: 11,
    color: AppColors.textMuted,
  },
  decideButton: {
    paddingVertical: 4,
    paddingHorizontal: 8,
  },
  decideButtonText: {
    fontSize: 12,
    fontWeight: '800',
    color: AppColors.primary,
  },
  classList: {
    gap: Spacing.three,
  },
  classCard: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.three + 2,
    gap: Spacing.three,
    ...CardShadow,
  },
  classHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  classTitleBlock: {
    flex: 1,
  },
  classNameText: {
    fontSize: 17,
    fontWeight: '800',
    color: AppColors.text,
  },
  classPracticalText: {
    fontSize: 13,
    color: AppColors.textMuted,
    marginTop: 2,
  },
  classActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
  },
  editClassButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderColor: AppColors.border,
  },
  editClassText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  deleteClassButton: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: Radius.md,
    backgroundColor: AppColors.dangerSoft,
  },
  deleteClassText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.danger,
  },
  memberSection: {
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    paddingTop: Spacing.two,
    gap: Spacing.two,
  },
  memberHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  memberCount: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.textMuted,
  },
  addMemberButton: {
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  addMemberText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  emptyMemberText: {
    fontSize: 12,
    color: AppColors.textMuted,
    fontStyle: 'italic',
  },
  memberList: {
    gap: 6,
  },
  memberRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    backgroundColor: AppColors.background,
    paddingHorizontal: Spacing.two + 2,
    paddingVertical: Spacing.one + 2,
    borderRadius: Radius.md,
  },
  memberInfo: {
    flex: 1,
  },
  memberName: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.text,
  },
  memberNim: {
    fontSize: 11,
    color: AppColors.textMuted,
  },
  removeMemberButton: {
    padding: 6,
  },
  removeMemberText: {
    color: AppColors.danger,
    fontSize: 12,
    fontWeight: '800',
  },
});
