import type { PropsWithChildren } from 'react';
import { StyleSheet } from 'react-native';
import { SafeAreaView, type Edge } from 'react-native-safe-area-context';

import { AppColors } from '@/constants/app-theme';

/** Insets route content below its native header and above device system areas. */
interface SafeAreaScreenProps extends PropsWithChildren {
  edges?: Edge[];
}

export function SafeAreaScreen({
  children,
  edges = ['bottom', 'left', 'right'],
}: SafeAreaScreenProps) {
  return (
    <SafeAreaView edges={edges} style={styles.container}>
      {children}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AppColors.background,
  },
});
