import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppButton } from '@/components/AppButton';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';

/** Initial Aslab landing page; lab management screens will be added in later Sprint 4 work. */
export default function AslabHomeScreen() {
  const { profile, logout } = useAuth();

  return (
    <ScrollView contentContainerStyle={styles.content}>
      <View style={styles.hero}>
        <Text style={styles.eyebrow}>PENGELOLA LABORATORIUM</Text>
        <Text style={styles.title}>Halo, {profile?.name ?? 'Aslab'}</Text>
        <Text style={styles.subtitle}>Anda masuk menggunakan role Aslab.</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Dashboard Aslab</Text>
        <Text style={styles.body}>
          Aslab memiliki ruang lingkup pengelolaan di atas asisten. Role asisten tetap terpisah dan tidak
          diubah; fitur manajemen laboratorium akan ditempatkan di dashboard ini.
        </Text>
        <View style={styles.profileRow}>
          <Text style={styles.label}>Identitas</Text>
          <Text style={styles.value}>{profile?.identifier ?? '—'}</Text>
        </View>
      </View>

      <AppButton title="Keluar" variant="ghost" onPress={() => void logout()} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  content: {
    width: '100%',
    maxWidth: 720,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
    gap: Spacing.three,
  },
  hero: {
    padding: Spacing.four,
    gap: Spacing.two,
    borderRadius: Radius.xl,
    backgroundColor: AppColors.primary,
  },
  eyebrow: { color: 'rgba(255,255,255,0.78)', fontSize: 11, fontWeight: '800', letterSpacing: 1.2 },
  title: { color: AppColors.textOnPrimary, fontSize: 26, fontWeight: '800' },
  subtitle: { color: 'rgba(255,255,255,0.9)', fontSize: 14 },
  card: {
    padding: Spacing.four,
    gap: Spacing.three,
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    ...CardShadow,
  },
  cardTitle: { color: AppColors.text, fontSize: 18, fontWeight: '800' },
  body: { color: AppColors.textMuted, fontSize: 14, lineHeight: 21 },
  profileRow: {
    paddingTop: Spacing.three,
    borderTopWidth: 1,
    borderTopColor: AppColors.border,
    gap: Spacing.one,
  },
  label: { color: AppColors.textMuted, fontSize: 12, fontWeight: '600' },
  value: { color: AppColors.text, fontSize: 14, fontWeight: '700' },
});
