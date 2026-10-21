/**
 * Design token aplikasi presensi (dipakai bersama alur praktikan & asisten).
 * Spacing tetap memakai `Spacing` dari `@/constants/theme`.
 */

export const AppColors = {
  primary: '#4F46E5',
  primaryDark: '#3730A3',
  primarySoft: '#EEF2FF',
  accent: '#7C3AED',
  background: '#F5F7FB',
  surface: '#FFFFFF',
  border: '#E4E7EE',
  text: '#0F172A',
  textMuted: '#64748B',
  textOnPrimary: '#FFFFFF',
  success: '#15803D',
  successSoft: '#DCFCE7',
  warning: '#B45309',
  warningSoft: '#FEF3C7',
  danger: '#B91C1C',
  dangerSoft: '#FEE2E2',
  neutral: '#475569',
  neutralSoft: '#E2E8F0',
  overlay: 'rgba(15, 23, 42, 0.45)',
} as const;

export const Radius = {
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  pill: 999,
} as const;

export const HeroGradient = `linear-gradient(135deg, ${AppColors.primary}, ${AppColors.accent})`;

export const CardShadow = {
  boxShadow: '0px 4px 14px rgba(15, 23, 42, 0.06)',
} as const;
