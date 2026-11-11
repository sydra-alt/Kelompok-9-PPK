import { router, Stack } from 'expo-router';

import { AppColors } from '@/constants/app-theme';
import { useAuth } from '@/context/AuthContext';

/**
 * Fondasi navigasi aplikasi (PIC: Programmer 1, koordinasi dengan Programmer 2).
 *
 * Sprint 2: rute dilindungi dengan `Stack.Protected` berdasarkan status
 * autentikasi Firebase & peran tepercaya dari `users/{uid}`:
 * - Belum login / memulihkan sesi -> `/` (LoginScreen) & `/register`
 * - Peran `praktikan`             -> `/student/*`
 * - Peran `asisten`               -> `/assistant/*`
 */

export const navigateTo = {
  roleSelection: () => router.dismissTo('/'),
  register: () => router.push('/register' as any),
  studentHome: (studentId?: string) =>
    router.push({ pathname: '/student', params: studentId ? { studentId } : undefined }),
  studentSessionDetail: (studentId: string, sessionId: string) =>
    router.push({ pathname: '/student/session/[sessionId]', params: { sessionId, studentId } }),
  studentHistory: (studentId?: string) =>
    router.push({ pathname: '/student/history', params: studentId ? { studentId } : undefined }),
  studentPermissions: () => router.push('/student/permissions' as any),
  assistantHome: (assistantId: string) =>
    router.push({ pathname: '/assistant', params: { assistantId } }),
  assistantSession: (assistantId: string, sessionId: string) =>
    router.push({ pathname: '/assistant/session/[sessionId]', params: { assistantId, sessionId } }),
  assistantRecap: (assistantId: string, sessionId?: string) =>
    router.push({ pathname: '/assistant/recap', params: { assistantId, sessionId } }),
};

export default function AppNavigator() {
  const { status, profile } = useAuth();
  const isAuthenticated = status === 'authenticated' && Boolean(profile);
  const isStudent = isAuthenticated && profile?.role === 'praktikan';
  const isAssistant = isAuthenticated && profile?.role === 'asisten';

  return (
    <Stack
      screenOptions={{
        headerStyle: { backgroundColor: AppColors.surface },
        headerTintColor: AppColors.primary,
        headerTitleStyle: { color: AppColors.text, fontWeight: '700' },
        headerShadowVisible: false,
        contentStyle: { backgroundColor: AppColors.background },
        headerBackTitle: 'Kembali',
      }}>
      {/* Rute autentikasi — hanya aktif sebelum profil terautentikasi penuh */}
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="register" options={{ title: 'Registrasi Praktikan' }} />
      </Stack.Protected>

      {/* Alur praktikan — Programmer 1 */}
      <Stack.Protected guard={isStudent}>
        <Stack.Screen
          name="student/index"
          options={{ title: 'Beranda Praktikan', headerBackVisible: false }}
        />
        <Stack.Screen name="student/session/[sessionId]" options={{ title: 'Detail Sesi' }} />
        <Stack.Screen name="student/history" options={{ title: 'Riwayat Kehadiran' }} />
        <Stack.Screen name="student/permissions" options={{ title: 'Pengajuan Izin' }} />
      </Stack.Protected>

      {/* Alur asisten — Programmer 2 */}
      <Stack.Protected guard={isAssistant}>
        <Stack.Screen
          name="assistant/index"
          options={{ title: 'Dashboard Asisten', headerBackVisible: false }}
        />
        <Stack.Screen name="assistant/session/[sessionId]" options={{ title: 'Kelola Sesi' }} />
        <Stack.Screen name="assistant/recap" options={{ title: 'Rekap Kehadiran' }} />
      </Stack.Protected>
    </Stack>
  );
}
