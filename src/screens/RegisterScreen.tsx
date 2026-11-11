import { router } from 'expo-router';
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

import { AppButton } from '@/components/AppButton';
import { ConnectionBanner } from '@/components/ConnectionBanner';
import { FeedbackBanner } from '@/components/FeedbackBanner';
import { AppColors, CardShadow, Radius } from '@/constants/app-theme';
import { Spacing } from '@/constants/theme';
import { useNetworkStatus } from '@/hooks/use-network-status';
import {
  hasErrors,
  registerStudent,
  validateRegister,
  type ValidationErrors,
} from '@/services/auth-service';
import { getErrorMessage } from '@/services/errors';

/**
 * Layar registrasi praktikan (PIC: Programmer 1).
 *
 * Sesuai kontrak keamanan Sprint 2:
 * - Pengguna yang mendaftar melalui aplikasi SELALU mendapatkan peran `praktikan`.
 * - Tidak ada opsi memilih peran `asisten` pada form registrasi.
 */
export default function RegisterScreen() {
  const { isOffline } = useNetworkStatus();

  const [name, setName] = useState('');
  const [identifier, setIdentifier] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const [fieldErrors, setFieldErrors] = useState<ValidationErrors>({});
  const [errorBanner, setErrorBanner] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const clearFieldError = (key: string) => {
    if (fieldErrors[key]) {
      setFieldErrors((prev) => ({ ...prev, [key]: undefined }));
    }
  };

  const handleRegister = async () => {
    const errors = validateRegister({ name, identifier, email, password, confirmPassword });
    setFieldErrors(errors);
    if (hasErrors(errors)) return;

    setSubmitting(true);
    setErrorBanner(null);
    try {
      await registerStudent({ name, identifier, email, password });
      // Setelah berhasil, listener AuthContext + Stack.Protected otomatis mengarahkan ke /student.
    } catch (err) {
      setErrorBanner(getErrorMessage(err, 'Gagal mendaftarkan akun praktikan.'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={styles.flex}>
      <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
        <ConnectionBanner isOffline={isOffline} />

        {errorBanner ? (
          <FeedbackBanner
            testID="register-feedback"
            type="error"
            title="Registrasi gagal"
            message={errorBanner}
            onClose={() => setErrorBanner(null)}
          />
        ) : null}

        <View style={styles.card}>
          <View style={styles.rolePill}>
            <Text style={styles.rolePillIcon}>🎓</Text>
            <Text style={styles.rolePillText}>Peran Akun: Praktikan (Terkunci)</Text>
          </View>

          <Text style={styles.title}>Buat Akun Praktikan</Text>
          <Text style={styles.subtitle}>
            Isi identitas sesuai data akademik. Setelah akun dibuat, asisten dapat menambahkanmu ke
            kelas praktikum yang diikuti.
          </Text>

          <View style={styles.field}>
            <Text style={styles.label}>Nama Lengkap</Text>
            <TextInput
              testID="register-name-input"
              value={name}
              editable={!submitting}
              onChangeText={(text) => {
                setName(text);
                clearFieldError('name');
              }}
              placeholder="Contoh: Ahmad Fauzan"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="words"
              style={[styles.input, fieldErrors.name && styles.inputError]}
            />
            {fieldErrors.name ? <Text style={styles.fieldError}>{fieldErrors.name}</Text> : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>NIM</Text>
            <TextInput
              testID="register-nim-input"
              value={identifier}
              editable={!submitting}
              onChangeText={(text) => {
                setIdentifier(text);
                clearFieldError('identifier');
              }}
              placeholder="Contoh: 2211102001"
              placeholderTextColor={AppColors.textMuted}
              autoCapitalize="characters"
              style={[styles.input, fieldErrors.identifier && styles.inputError]}
            />
            {fieldErrors.identifier ? (
              <Text style={styles.fieldError}>{fieldErrors.identifier}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Email</Text>
            <TextInput
              testID="register-email-input"
              value={email}
              editable={!submitting}
              onChangeText={(text) => {
                setEmail(text);
                clearFieldError('email');
              }}
              placeholder="nama@mahasiswa.ac.id"
              placeholderTextColor={AppColors.textMuted}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              style={[styles.input, fieldErrors.email && styles.inputError]}
            />
            {fieldErrors.email ? <Text style={styles.fieldError}>{fieldErrors.email}</Text> : null}
          </View>

          <View style={styles.field}>
            <View style={styles.labelRow}>
              <Text style={styles.label}>Kata Sandi</Text>
              <Pressable onPress={() => setShowPassword((prev) => !prev)}>
                <Text style={styles.toggleText}>{showPassword ? 'Sembunyikan' : 'Lihat'}</Text>
              </Pressable>
            </View>
            <TextInput
              testID="register-password-input"
              value={password}
              editable={!submitting}
              onChangeText={(text) => {
                setPassword(text);
                clearFieldError('password');
              }}
              placeholder="Minimal 6 karakter"
              placeholderTextColor={AppColors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, fieldErrors.password && styles.inputError]}
            />
            {fieldErrors.password ? (
              <Text style={styles.fieldError}>{fieldErrors.password}</Text>
            ) : null}
          </View>

          <View style={styles.field}>
            <Text style={styles.label}>Konfirmasi Kata Sandi</Text>
            <TextInput
              testID="register-confirm-password-input"
              value={confirmPassword}
              editable={!submitting}
              onChangeText={(text) => {
                setConfirmPassword(text);
                clearFieldError('confirmPassword');
              }}
              placeholder="Ulangi kata sandi"
              placeholderTextColor={AppColors.textMuted}
              secureTextEntry={!showPassword}
              autoCapitalize="none"
              style={[styles.input, fieldErrors.confirmPassword && styles.inputError]}
            />
            {fieldErrors.confirmPassword ? (
              <Text style={styles.fieldError}>{fieldErrors.confirmPassword}</Text>
            ) : null}
          </View>

          <AppButton
            testID="register-submit-button"
            title={submitting ? 'Mendaftarkan...' : 'Daftar Sekarang'}
            disabled={submitting}
            onPress={() => void handleRegister()}
          />

          <AppButton
            title="Sudah punya akun? Masuk"
            variant="ghost"
            disabled={submitting}
            onPress={() => router.back()}
          />
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  content: {
    width: '100%',
    maxWidth: 560,
    alignSelf: 'center',
    padding: Spacing.three,
    paddingBottom: Spacing.six,
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
  rolePill: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'flex-start',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: Radius.pill,
    backgroundColor: AppColors.primarySoft,
  },
  rolePillIcon: {
    fontSize: 13,
  },
  rolePillText: {
    fontSize: 12,
    fontWeight: '700',
    color: AppColors.primaryDark,
  },
  title: {
    fontSize: 20,
    fontWeight: '800',
    color: AppColors.text,
  },
  subtitle: {
    fontSize: 13,
    lineHeight: 19,
    color: AppColors.textMuted,
    marginTop: -Spacing.two,
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
  toggleText: {
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
  inputError: {
    borderColor: AppColors.danger,
    backgroundColor: AppColors.dangerSoft,
  },
  fieldError: {
    fontSize: 12,
    color: AppColors.danger,
    fontWeight: '600',
  },
});

