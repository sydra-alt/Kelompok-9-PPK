import { StatusBar } from 'expo-status-bar';
import { useState } from 'react';
import {
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { FeedbackBanner, type FeedbackType } from '@/components/FeedbackBanner';
import { LoadingState } from '@/components/LoadingState';
import { AppColors, CardShadow, HeroGradient, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useAuth } from '@/context/AuthContext';
import { useNetworkStatus } from '@/hooks/use-network-status';
import { navigateTo } from '@/navigation/AppNavigator';
import {
  completeStudentProfile,
  hasErrors,
  requestPasswordReset,
  signIn,
  validateLogin,
  validateProfileCompletion,
  type ValidationErrors,
} from '@/services/auth-service';
import { getErrorMessage } from '@/services/errors';

interface Feedback {
  type: FeedbackType;
  title: string;
  message: string;
}

/**
 * Layar autentikasi utama (PIC: Programmer 1).
 * Menangani pemulihan sesi, validasi konfigurasi Firebase, login, lupa sandi,
 * serta pelengkapan profil bila dokumen `users/{uid}` belum tersedia.
 */
export default function LoginScreen() {
  const { status, firebaseUser, errorMessage, missingEnv, retryProfile, logout } = useAuth();
  const { isOffline } = useNetworkStatus();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // State khusus saat akun Auth ada tetapi profil `users/{uid}` belum terbentuk.
  const [profileName, setProfileName] = useState(firebaseUser?.displayName ?? '');
  const [profileNim, setProfileNim] = useState('');

  if (status === 'initializing') {
    return (
      <SafeAreaView style={styles.loadingRoot}>
        <StatusBar style="dark" />
        <LoadingState
          title="Memulihkan sesi..."
          message="Memeriksa status login dan memuat profil pengguna."
        />
      </SafeAreaView>
    );
  }

  if (status === 'config-missing') {
    return (
      <SafeAreaView style={styles.loadingRoot} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.centeredScroll}>
          <View style={styles.card}>
            <Text style={styles.configIcon}>⚙️</Text>
            <Text style={styles.cardTitle}>Konfigurasi Firebase Belum Lengkap</Text>
            <Text style={styles.cardSubtitle}>
              Salin berkas <Text style={styles.mono}>.env.example</Text> menjadi{' '}
              <Text style={styles.mono}>.env</Text> di root proyek, isi variabel berikut, lalu jalankan
              ulang <Text style={styles.mono}>npx expo start --clear</Text>:
            </Text>
            <View style={styles.envList}>
              {missingEnv.map((envName) => (
                <Text key={envName} style={styles.envItem}>
                  • {envName}
                </Text>
              ))}
            </View>
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  if (status === 'error') {
    return (
      <SafeAreaView style={styles.loadingRoot} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <View style={styles.centeredScroll}>
          <View style={styles.card}>
            <Text style={styles.configIcon}>⚠️</Text>
            <Text style={styles.cardTitle}>Gagal Memuat Profil</Text>
            <Text style={styles.cardSubtitle}>
              {errorMessage ?? 'Tidak dapat memuat profil pengguna dari Firestore.'}
            </Text>
            <AppButton title="Coba Lagi" onPress={retryProfile} />
            <AppButton title="Keluar Akun" variant="ghost" onPress={() => void logout()} />
          </View>
        </View>
      </SafeAreaView>
    );
  }

  if (status === 'profile-missing') {
    const handleCompleteProfile = async () => {
      const errors = validateProfileCompletion(profileName, profileNim);
      setFieldErrors(errors);
      if (hasErrors(errors)) return;

      setSubmitting(true);
      setFeedback(null);
      try {
        await completeStudentProfile({ name: profileName, identifier: profileNim });
        retryProfile();
      } catch (err) {
        setFeedback({
          type: 'error',
          title: 'Gagal menyimpan profil',
          message: getErrorMessage(err),
        });
      } finally {
        setSubmitting(false);
      }
    };

    return (
      <SafeAreaView style={styles.loadingRoot} edges={['top', 'bottom']}>
        <StatusBar style="dark" />
        <ScrollView contentContainerStyle={styles.centeredScroll} keyboardShouldPersistTaps="handled">
          <View style={styles.card}>
            <Text style={styles.cardTitle}>Lengkapi Profil Praktikan</Text>
            <Text style={styles.cardSubtitle}>
              Akun <Text style={styles.mono}>{firebaseUser?.email}</Text> belum memiliki profil di
              Firestore. Lengkapi identitas praktikan di bawah ini untuk melanjutkan.
            </Text>

            {feedback ? (
              <FeedbackBanner
                type={feedback.type}
                title={feedback.title}
                message={feedback.message}
                onClose={() => setFeedback(null)}
              />
            ) : null}

            <View style={styles.field}>
              <Text style={styles.label}>Nama Lengkap</Text>
              <TextInput
                value={profileName}
                editable={!submitting}
                onChangeText={setProfileName}
                placeholder="Contoh: Ahmad Fauzan"
                placeholderTextColor={AppColors.textMuted}
                style={[styles.input, fieldErrors.name && styles.inputError]}
              />
              {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
            </View>

            <View style={styles.field}>
              <Text style={styles.label}>NIM</Text>
              <TextInput
                value={profileNim}
                editable={!submitting}
                onChangeText={setProfileNim}
                placeholder="Contoh: 2211102001"
                placeholderTextColor={AppColors.textMuted}
                style={[styles.input, fieldErrors.identifier && styles.inputError]}
              />
              {fieldErrors.identifier ? (
                <Text style={styles.fieldError}>{fieldErrors.identifier}</Text>
              ) : null}
            </View>

            <AppButton
              title={submitting ? 'Menyimpan...' : 'Simpan Profil Praktikan'}
              disabled={submitting}
              onPress={() => void handleCompleteProfile()}
            />
            <AppButton
              title="Keluar Akun"
              variant="ghost"
              disabled={submitting}
              onPress={() => void logout()}
            />
          </View>
        </ScrollView>
      </SafeAreaView>
    );
  }

  const handleLogin = async () => {
    const errors = validateLogin(email, password);
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    setFeedback(null);
    try {
      await signIn(email, password);
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Gagal masuk',
        message: getErrorMessage(err, 'Email atau kata sandi tidak valid.'),
      });
    } finally {
      setSubmitting(false);
    }
  };

  const handleForgotPassword = async () => {
    const trimmed = email.trim();
    if (!trimmed) {
      setFieldErrors((prev) => ({
        ...prev,
        email: 'Masukkan email terlebih dahulu untuk mengatur ulang kata sandi.',
      }));
      return;
    }
    setSubmitting(true);
    setFeedback(null);
    try {
      await requestPasswordReset(trimmed);
      setFeedback({
        type: 'success',
        title: 'Email terkirim',
        message: `Tautan pengaturan ulang kata sandi telah dikirim ke ${trimmed}.`,
      });
    } catch (err) {
      setFeedback({
        type: 'error',
        title: 'Gagal mengirim email reset',
        message: getErrorMessage(err),
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea} edges={['top', 'bottom']}>
      <StatusBar style="light" />
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.flex}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <View style={styles.container}>
            <View style={styles.hero}>
              <Text style={styles.heroEyebrow}>KELOMPOK 9 • PPK</Text>
              <Text style={styles.heroTitle}>Presensi Praktikum</Text>
              <Text style={styles.heroSubtitle}>
                Masuk menggunakan akun praktikan atau asisten untuk mengakses jadwal, presensi, dan
                pengajuan izin secara real-time.
              </Text>
            </View>

            <View style={styles.formSection}>
              <ConnectionBanner isOffline={isOffline} />

              {feedback ? (
                <FeedbackBanner
                  testID="login-feedback"
                  type={feedback.type}
                  title={feedback.title}
                  message={feedback.message}
                  onClose={() => setFeedback(null)}
                />
              ) : null}

              <View style={styles.card}>
                <Text style={styles.cardTitle}>Masuk ke Akun</Text>

                <View style={styles.field}>
                  <Text style={styles.label}>Email</Text>
                  <TextInput
                    testID="login-email-input"
                    value={email}
                    editable={!submitting}
                    onChangeText={(text) => {
                      setEmail(text);
                      if (fieldErrors.email) setFieldErrors((prev) => ({ ...prev, email: undefined }));
                    }}
                    placeholder="nama@mahasiswa.ac.id"
                    placeholderTextColor={AppColors.textMuted}
                    keyboardType="email-address"
                    autoCapitalize="none"
                    autoCorrect={false}
                    style={[styles.input, fieldErrors.email && styles.inputError]}
                  />
                  {fieldErrors.email ? (
                    <Text testID="login-email-error" style={styles.fieldError}>
                      {fieldErrors.email}
                    </Text>
                  ) : null}
                </View>

                <View style={styles.field}>
                  <View style={styles.labelRow}>
                    <Text style={styles.label}>Kata Sandi</Text>
                    <Pressable
                      testID="login-forgot-password"
                      disabled={submitting}
                      onPress={() => void handleForgotPassword()}>
                      <Text style={styles.linkText}>Lupa kata sandi?</Text>
                    </Pressable>
                  </View>
                  <View style={[styles.passwordWrap, fieldErrors.password && styles.inputError]}>
                    <TextInput
                      testID="login-password-input"
                      value={password}
                      editable={!submitting}
                      onChangeText={(text) => {
                        setPassword(text);
                        if (fieldErrors.password) {
                          setFieldErrors((prev) => ({ ...prev, password: undefined }));
                        }
                      }}
                      placeholder="Masukkan kata sandi"
                      placeholderTextColor={AppColors.textMuted}
                      secureTextEntry={!showPassword}
                      autoCapitalize="none"
                      style={styles.passwordInput}
                    />
                    <Pressable
                      onPress={() => setShowPassword((prev) => !prev)}
                      hitSlop={8}
                      accessibilityRole="button">
                      <Text style={styles.togglePassword}>{showPassword ? 'Sembunyikan' : 'Lihat'}</Text>
                    </Pressable>
                  </View>
                  {fieldErrors.password ? (
                    <Text testID="login-password-error" style={styles.fieldError}>
                      {fieldErrors.password}
                    </Text>
                  ) : null}
                </View>

                <AppButton
                  testID="login-submit-button"
                  title={submitting ? 'Memproses...' : 'Masuk'}
                  disabled={submitting}
                  onPress={() => void handleLogin()}
                />

                <View style={styles.dividerRow}>
                  <View style={styles.dividerLine} />
                  <Text style={styles.dividerText}>Belum punya akun praktikan?</Text>
                  <View style={styles.dividerLine} />
                </View>

                <AppButton
                  testID="go-to-register-button"
                  title="Daftar sebagai Praktikan"
                  variant="secondary"
                  disabled={submitting}
                  onPress={navigateTo.register}
                />
              </View>

              <View style={styles.roleInfoCard}>
                <Text style={styles.roleInfoTitle}>🔒 Informasi Peran & Otorisasi</Text>
                <Text style={styles.roleInfoText}>
                  Registrasi mandiri hanya membuat akun dengan peran{' '}
                  <Text style={styles.roleInfoBold}>Praktikan</Text>. Peran{' '}
                  <Text style={styles.roleInfoBold}>Asisten</Text> ditetapkan oleh pengajar/admin pada
                  koleksi <Text style={styles.mono}>users/{'{uid}'}</Text> di Firebase Console.
                </Text>
              </View>
            </View>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  safeArea: {
    flex: 1,
    backgroundColor: AppColors.primary,
  },
  loadingRoot: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
  scroll: {
    flexGrow: 1,
    backgroundColor: AppColors.background,
  },
  centeredScroll: {
    flexGrow: 1,
    justifyContent: 'center',
    padding: Spacing.four,
    maxWidth: 560,
    width: '100%',
    alignSelf: 'center',
  },
  container: {
    width: '100%',
    maxWidth: 560,
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
    fontSize: 14,
    lineHeight: 21,
  },
  formSection: {
    paddingHorizontal: Spacing.four,
    gap: Spacing.three,
  },
  card: {
    backgroundColor: AppColors.surface,
    borderRadius: Radius.lg,
    borderWidth: 1,
    borderColor: AppColors.border,
    padding: Spacing.four,
    gap: Spacing.three,
    ...CardShadow,
  },
  configIcon: {
    fontSize: 32,
    textAlign: 'center',
  },
  cardTitle: {
    fontSize: 19,
    fontWeight: '800',
    color: AppColors.text,
  },
  cardSubtitle: {
    fontSize: 13,
    lineHeight: 20,
    color: AppColors.textMuted,
  },
  envList: {
    backgroundColor: AppColors.background,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  envItem: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.danger,
  },
  mono: {
    fontWeight: '700',
    color: AppColors.text,
  },
  field: {
    gap: 6,
  },
  labelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  label: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.text,
  },
  linkText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
  },
  input: {
    minHeight: 48,
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    fontSize: 14,
    color: AppColors.text,
    backgroundColor: AppColors.background,
  },
  passwordWrap: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: AppColors.border,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    backgroundColor: AppColors.background,
  },
  passwordInput: {
    flex: 1,
    fontSize: 14,
    color: AppColors.text,
    paddingVertical: 10,
  },
  togglePassword: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primary,
    marginLeft: Spacing.two,
  },
  inputError: {
    borderColor: AppColors.danger,
    backgroundColor: AppColors.dangerSoft,
  },
  fieldError: {
    fontSize: 12,
    color: AppColors.danger,
    fontWeight: '600',
  },
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    marginVertical: 2,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: AppColors.border,
  },
  dividerText: {
    fontSize: 12,
    color: AppColors.textMuted,
    fontWeight: '600',
  },
  roleInfoCard: {
    backgroundColor: AppColors.primarySoft,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 4,
  },
  roleInfoTitle: {
    fontSize: 13,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  roleInfoText: {
    fontSize: 12,
    lineHeight: 18,
    color: AppColors.neutral,
  },
  roleInfoBold: {
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
});

