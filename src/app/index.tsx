import { SafeAreaScreen } from '@/components/SafeAreaScreen';
import LoginScreen from '@/screens/LoginScreen';

export default function LoginRoute() {
  return (
    <SafeAreaScreen edges={['left', 'right']}>
      <LoginScreen />
    </SafeAreaScreen>
  );
}
