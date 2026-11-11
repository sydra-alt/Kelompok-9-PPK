import NetInfo from '@react-native-community/netinfo';
import { useEffect, useState } from 'react';

/**
 * Pantau status jaringan perangkat secara real-time.
 * Mengembalikan `isOffline = true` saat tidak ada koneksi internet.
 */
export function useNetworkStatus(): { isOffline: boolean } {
  const [isOffline, setIsOffline] = useState(false);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const connected = state.isConnected !== false && state.isInternetReachable !== false;
      setIsOffline(!connected);
    });
    return unsubscribe;
  }, []);

  return { isOffline };
}

