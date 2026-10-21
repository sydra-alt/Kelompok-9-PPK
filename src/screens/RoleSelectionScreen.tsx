import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { AppColors, CardShadow, HeroGradient, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { getUsersByRole } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';
import type { UserRole } from '@/types';
import { getInitials } from '@/utils/format';

const ROLE_OPTIONS: { role: UserRole; icon: string; title: string; description: string }[] = [
  {
    role: 'student',
    icon: '🎓',
    title: 'Praktikan',
    description: 'Lihat jadwal, presensi, dan riwayat kehadiran.',
  },
  {
    role: 'assistant',
    icon: '🧑‍🏫',
    title: 'Asisten',
    description: 'Kelola sesi dan lihat rekap presensi.',
  },
];

/** FR-01 — Pemilihan peran dan identitas dummy. */
export default function RoleSelectionScreen() {
  const [role, setRole] = useState<UserRole | null>(null);
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const identities = role ? getUsersByRole(role) : [];

  const handleRoleChange = (nextRole: UserRole) => {
    setRole(nextRole);
    setSelectedUserId(null);
    setError(null);
  };

  const handleContinue = () => {
    if (!role) {
      setError('Pilih peran terlebih dahulu.');
      return;
    }
    if (!selectedUserId) {
      setError('Pilih identitas yang akan digunakan.');
      return;
    }
    setError(null);
    if (role === 'student') {
      navigateTo.studentHome(selectedUserId);
    } else {
      navigateTo.assistantHome(selectedUserId);
    }
  };

  const isComplete = Boolean(role && selectedUserId);

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
        <View style={styles.container}>
          <View style={styles.hero}>
            <Text style={styles.heroEyebrow}>KELOMPOK 9 • PPK</Text>
            <Text style={styles.heroTitle}>Presensi Praktikum</Text>
            <Text style={styles.heroSubtitle}>
              Simulasi alur praktikum untuk praktikan dan asisten. Pilih peran dan identitas untuk mulai.
            </Text>
          </View>

          <Section step="1" title="Pilih Peran">
            <View style={styles.roleRow}>
              {ROLE_OPTIONS.map((option) => {
                const selected = role === option.role;
                return (
                  <Pressable
                    key={option.role}
                    testID={`role-${option.role}`}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    onPress={() => handleRoleChange(option.role)}
                    style={({ pressed }) => [
                      styles.roleCard,
                      selected && styles.roleCardSelected,
                      pressed && styles.pressed,
                    ]}>
                    <Text style={styles.roleIcon}>{option.icon}</Text>
                    <Text style={[styles.roleTitle, selected && styles.roleTitleSelected]}>
                      {option.title}
                    </Text>
                    <Text style={styles.roleDescription}>{option.description}</Text>
                  </Pressable>
                );
              })}
            </View>
          </Section>

          <Section step="2" title="Pilih Identitas">
            {!role ? (
              <Text style={styles.hint}>Pilih peran terlebih dahulu untuk menampilkan daftar identitas.</Text>
            ) : (
              <View style={styles.identityList}>
                {identities.map((user) => {
                  const selected = selectedUserId === user.id;
                  return (
                    <Pressable
                      key={user.id}
                      testID={`identity-${user.id}`}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => {
                        setSelectedUserId(user.id);
                        setError(null);
                      }}
                      style={({ pressed }) => [
                        styles.identityRow,
                        selected && styles.identityRowSelected,
                        pressed && styles.pressed,
                      ]}>
                      <View style={[styles.avatar, selected && styles.avatarSelected]}>
                        <Text style={[styles.avatarText, selected && styles.avatarTextSelected]}>
                          {getInitials(user.name)}
                        </Text>
                      </View>
                      <View style={styles.identityInfo}>
                        <Text style={styles.identityName}>{user.name}</Text>
                        <Text style={styles.identityMeta}>
                          {user.identifier} • {user.className}
                        </Text>
                      </View>
                      <View style={[styles.radio, selected && styles.radioSelected]}>
                        {selected ? <View style={styles.radioDot} /> : null}
                      </View>
                    </Pressable>
                  );
                })}
              </View>
            )}
          </Section>

          {error ? (
            <Text testID="role-selection-error" style={styles.error}>
              {error}
            </Text>
          ) : null}

          <AppButton
            testID="role-selection-continue"
            title={isComplete ? 'Masuk' : 'Lengkapi Pilihan'}
            variant={isComplete ? 'primary' : 'secondary'}
            onPress={handleContinue}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function Section({ step, title, children }: { step: string; title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <View style={styles.stepBadge}>
          <Text style={styles.stepText}>{step}</Text>
        </View>
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.primary,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: AppColors.background,
  },
  container: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    gap: Spacing.four,
    paddingBottom: Spacing.five,
  },
  hero: {
    backgroundColor: AppColors.primary,
    experimental_backgroundImage: HeroGradient,
    paddingHorizontal: Spacing.four,
    paddingTop: Spacing.five,
    paddingBottom: Spacing.five + Spacing.two,
    borderBottomLeftRadius: Radius.xl,
    borderBottomRightRadius: Radius.xl,
    gap: Spacing.two,
  },
  heroEyebrow: {
    color: 'rgba(255,255,255,0.75)',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
  },
  heroTitle: {
    color: AppColors.textOnPrimary,
    fontSize: 30,
    fontWeight: '800',
  },
  heroSubtitle: {
    color: 'rgba(255,255,255,0.88)',
    fontSize: 15,
    lineHeight: 22,
  },
  section: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two + 2,
  },
  stepBadge: {
    width: 26,
    height: 26,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepText: {
    color: AppColors.textOnPrimary,
    fontSize: 13,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: '700',
    color: AppColors.text,
  },
  roleRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.three,
  },
  roleCard: {
    flexGrow: 1,
    flexBasis: 150,
    padding: Spacing.three,
    gap: Spacing.one + 2,
    borderRadius: Radius.lg,
    borderWidth: 2,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
    ...CardShadow,
  },
  roleCardSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  roleIcon: {
    fontSize: 28,
  },
  roleTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: AppColors.text,
  },
  roleTitleSelected: {
    color: AppColors.primaryDark,
  },
  roleDescription: {
    fontSize: 13,
    lineHeight: 18,
    color: AppColors.textMuted,
  },
  hint: {
    fontSize: 14,
    color: AppColors.textMuted,
    padding: Spacing.three,
    borderRadius: Radius.md,
    borderWidth: 1,
    borderStyle: 'dashed',
    borderColor: AppColors.border,
    textAlign: 'center',
  },
  identityList: {
    gap: Spacing.two + 2,
  },
  identityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
    padding: Spacing.three,
    borderRadius: Radius.lg,
    borderWidth: 1.5,
    borderColor: AppColors.border,
    backgroundColor: AppColors.surface,
  },
  identityRowSelected: {
    borderColor: AppColors.primary,
    backgroundColor: AppColors.primarySoft,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.background,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarSelected: {
    backgroundColor: AppColors.primary,
  },
  avatarText: {
    fontSize: 15,
    fontWeight: '800',
    color: AppColors.neutral,
  },
  avatarTextSelected: {
    color: AppColors.textOnPrimary,
  },
  identityInfo: {
    flex: 1,
    gap: 2,
  },
  identityName: {
    fontSize: 15,
    fontWeight: '700',
    color: AppColors.text,
  },
  identityMeta: {
    fontSize: 13,
    color: AppColors.textMuted,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: Radius.pill,
    borderWidth: 2,
    borderColor: AppColors.border,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioSelected: {
    borderColor: AppColors.primary,
  },
  radioDot: {
    width: 11,
    height: 11,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primary,
  },
  error: {
    marginHorizontal: Spacing.four,
    marginBottom: -Spacing.two,
    color: AppColors.danger,
    fontSize: 14,
    fontWeight: '600',
    textAlign: 'center',
  },
  pressed: {
    opacity: 0.85,
  },
});
