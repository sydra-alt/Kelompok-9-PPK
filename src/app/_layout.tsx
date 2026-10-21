import { DefaultTheme, ThemeProvider } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';

import { AnimatedSplashOverlay } from '@/components/animated-icon';
import { AppColors } from '@/constants/app-theme';
import AppNavigator from '@/navigation/AppNavigator';

SplashScreen.preventAutoHideAsync();

const AppTheme = {
  ...DefaultTheme,
  colors: {
    ...DefaultTheme.colors,
    primary: AppColors.primary,
    background: AppColors.background,
    card: AppColors.surface,
    text: AppColors.text,
    border: AppColors.border,
  },
};

export default function RootLayout() {
  return (
    <ThemeProvider value={AppTheme}>
      <AnimatedSplashOverlay />
      <AppNavigator />
    </ThemeProvider>
  );
}
