import { router, Stack } from 'expo-router';
import { Pressable, Text } from 'react-native';

import { AppColors } from '@/constants/app-theme';
import { useAuth } from '@/context/AuthContext';

/**
 * Navigasi utama aplikasi berdasarkan status autentikasi dan peran pengguna.
 *
 * Sprint 2: rute dilindungi dengan `Stack.Protected` berdasarkan status
 * autentikasi Firebase & peran tepercaya dari `users/{uid}`:
 * - Belum login / memulihkan sesi -> `/` (LoginScreen) & `/register`
 * - Peran `praktikan`             -> `/student/*`
 * - Peran `asisten`               -> `/assistant/*` (role lama dipertahankan)
 * - Peran `aslab`                 -> `/aslab/*` (role terpisah dengan kewenangan lebih tinggi)
 */

export const navigateTo = {
  roleSelection: () => router.dismissTo('/'),
  register: () => router.push('/register' as any),
  studentHome: (studentId?: string) =>
    router.push({ pathname: '/student', params: studentId ? { studentId } : undefined }),
  studentSessionDetail: (studentId: string, sessionId: string) =>
    router.push({ pathname: '/student/session/[sessionId]', params: { sessionId, studentId } }),
  studentAttendance: (sessionId: string) =>
    router.push({ pathname: '/student/attendance/[sessionId]' as any, params: { sessionId } }),
  studentLabsMap: () => router.push('/student/maps' as any),
  labsMap: () => router.push('/maps' as any),
  studentQrScanner: () => router.push('/student/scan' as any),
  assistantQr: () => router.push('/assistant/qr' as any),
  studentHistory: (studentId?: string) =>
    router.push({ pathname: '/student/history', params: studentId ? { studentId } : undefined }),
  studentFines: () => router.push('/student/fines' as any),
  studentPayments: () => router.push('/student/payments' as any),
  studentPermissions: () => router.push('/student/permissions' as any),
  assistantHome: (assistantId: string) =>
    router.push({ pathname: '/assistant', params: { assistantId } }),
  assistantSession: (assistantId: string, sessionId: string) =>
    router.push({ pathname: '/assistant/session/[sessionId]', params: { assistantId, sessionId } }),
  assistantRecap: (assistantId: string, sessionId: string) =>
    router.push({ pathname: '/assistant/recap', params: { assistantId, sessionId } }),
  aslabHome: () => router.push('/aslab'),
};

export default function AppNavigator() {
  const { status, profile } = useAuth();
  const role = profile?.role;
  const isAuthenticated = status === 'authenticated' && Boolean(role);
  const isStudent = isAuthenticated && role === 'praktikan';
  const isAssistant = isAuthenticated && role === 'asisten';
  const isLabAssistant = isAuthenticated && role === 'aslab';

  const homeRoute =
    role === 'praktikan'
      ? '/student'
      : role === 'asisten'
        ? '/assistant'
        : role === 'aslab'
          ? '/aslab'
          : '/';

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        headerStyle: { backgroundColor: AppColors.surface },
        headerTintColor: AppColors.primary,
        headerTitleStyle: { color: AppColors.text, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AppColors.background },
        headerBackTitle: 'Kembali',
        headerRight: isAuthenticated ? () => (
          <Pressable onPress={navigateTo.labsMap} accessibilityRole="button" accessibilityLabel="Buka peta laboratorium" style={{ paddingHorizontal: 8, paddingVertical: 6 }}>
            <Text style={{ color: AppColors.primary, fontWeight: '700' }}>Peta</Text>
          </Pressable>
        ) : undefined,
      }}>
      {/* Rute autentikasi — hanya aktif sebelum profil terautentikasi penuh */}
      <Stack.Protected guard={!isAuthenticated} redirectTo={homeRoute}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Registrasi Praktikan' }} />
      </Stack.Protected>

      {/* Peta laboratorium adalah informasi bersama dan dapat dibuka oleh semua role. */}
      <Stack.Protected guard={isAuthenticated} redirectTo="/">
        <Stack.Screen name="maps" options={{ title: 'Peta Laboratorium' }} />
      </Stack.Protected>

      {/* Alur praktikan */}
      <Stack.Protected
        guard={isStudent}
        redirectTo={isAssistant ? '/assistant' : isLabAssistant ? '/aslab' : '/'}>
        <Stack.Screen
          name="student/index"
          options={{ title: 'Beranda Praktikan', headerBackVisible: false }}
        />
        <Stack.Screen name="student/session/[sessionId]" options={{ title: 'Detail Sesi' }} />
        <Stack.Screen name="student/attendance/[sessionId]" options={{ title: 'Presensi Lokasi' }} />
        <Stack.Screen
          name="student/maps"
          options={{ title: 'Peta Laboratorium', headerBackVisible: true }}
        />
        <Stack.Screen name="student/history" options={{ title: 'Riwayat Kehadiran' }} />
        <Stack.Screen name="student/fines" options={{ title: 'Tagihan Denda' }} />
        <Stack.Screen name="student/payments" options={{ title: 'Riwayat Pembayaran' }} />
        <Stack.Screen name="student/permissions" options={{ title: 'Pengajuan Izin' }} />
        <Stack.Screen name="student/scan" options={{ title: 'Scan QR Presensi', headerShown: false }} />
      </Stack.Protected>

      {/* Alur asisten */}
      <Stack.Protected
        guard={isAssistant}
        redirectTo={isStudent ? '/student' : isLabAssistant ? '/aslab' : '/'}>
        <Stack.Screen
          name="assistant/index"
          options={{ title: 'Dashboard Asisten', headerBackVisible: false }}
        />
        <Stack.Screen name="assistant/session/[sessionId]" options={{ title: 'Kelola Sesi' }} />
        <Stack.Screen name="assistant/recap" options={{ title: 'Rekap Kehadiran' }} />
        <Stack.Screen name="assistant/qr" options={{ title: 'QR Presensi Sesi' }} />
      </Stack.Protected>

      {/* Aslab adalah role tersendiri dan berada di atas asisten. */}
      <Stack.Protected
        guard={isLabAssistant}
        redirectTo={isStudent ? '/student' : isAssistant ? '/assistant' : '/'}>
        <Stack.Screen
          name="aslab/index"
          options={{ title: 'Dashboard Aslab', headerBackVisible: false }}
        />
      </Stack.Protected>
    </Stack>
  );
}
