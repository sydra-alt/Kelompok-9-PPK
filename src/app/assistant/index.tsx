import { useLocalSearchParams } from 'expo-router';

import { EmptyState } from '@/components/EmptyState';
import { getUserById } from '@/data/users';
import { navigateTo } from '@/navigation/AppNavigator';

/**
 * PLACEHOLDER — dikerjakan Programmer 2.
 * Ganti seluruh isi file ini dengan:
 *   export { default } from '@/screens/AssistantHomeScreen';
 * Parameter yang dikirim dari pemilihan peran: `assistantId`.
 */
export default function AssistantPlaceholderRoute() {
  const { assistantId } = useLocalSearchParams<{ assistantId: string }>();
  const assistant = getUserById(assistantId);

  return (
    <EmptyState
      icon="🚧"
      title={`Halo, ${assistant?.name ?? 'Asisten'}`}
      message="Dashboard asisten sedang dikerjakan oleh Programmer 2."
      actionLabel="Kembali ke Pemilihan Peran"
      onAction={navigateTo.roleSelection}
    />
  );
}
