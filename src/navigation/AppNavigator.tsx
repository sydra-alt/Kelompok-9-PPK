import { router, Stack } from 'expo-router';

import { AppColors } from '@/constants/app-theme';

/**
 * Fondasi navigasi aplikasi (PIC: Programmer 1, koordinasi dengan Programmer 2).
 *
 * Proyek memakai Expo Router (file-based routing): setiap file di `src/app/`
 * adalah satu rute, sedangkan isi layarnya berada di `src/screens/`.
 * File ini mendefinisikan Stack navigator utama + helper navigasi agar
 * path rute tidak ditulis berulang di banyak layar.
 *
 * Peta rute:
 *   /                              -> RoleSelectionScreen
 *   /student?studentId=            -> StudentHomeScreen
 *   /student/session/[sessionId]   -> StudentSessionDetailScreen
 *   /student/history?studentId=    -> StudentAttendanceHistoryScreen
 *   /assistant?assistantId=        -> AssistantHomeScreen (Programmer 2)
 */

export const navigateTo = {
  roleSelection: () => router.dismissTo('/'),
  studentHome: (studentId: string) => router.push({ pathname: '/student', params: { studentId } }),
  studentSessionDetail: (studentId: string, sessionId: string) =>
    router.push({ pathname: '/student/session/[sessionId]', params: { sessionId, studentId } }),
  studentHistory: (studentId: string) =>
    router.push({ pathname: '/student/history', params: { studentId } }),
  assistantHome: (assistantId: string) =>
    router.push({ pathname: '/assistant', params: { assistantId } }),
};

export default function AppNavigator() {
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
      <Stack.Screen name="index" options={{ headerShown: false }} />

      {/* Alur praktikan — Programmer 1 */}
      <Stack.Screen name="student/index" options={{ title: 'Beranda Praktikan' }} />
      <Stack.Screen name="student/session/[sessionId]" options={{ title: 'Detail Sesi' }} />
      <Stack.Screen name="student/history" options={{ title: 'Riwayat Kehadiran' }} />

      {/* Alur asisten — Programmer 2 (tambahkan rute asisten di bawah ini) */}
      <Stack.Screen name="assistant/index" options={{ title: 'Dashboard Asisten' }} />
    </Stack>
  );
}
