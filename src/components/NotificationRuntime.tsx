import { useEffect } from 'react';
import * as Notifications from 'expo-notifications';
import { router } from 'expo-router';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

/** Listener global untuk notifikasi masuk dan respons saat notifikasi ditekan. */
export function NotificationRuntime() {
  useEffect(() => {
    const handledResponseIds = new Set<string>();

    const handleResponse = (response: Notifications.NotificationResponse) => {
      const request = response.notification.request;
      if (handledResponseIds.has(request.identifier)) return;
      handledResponseIds.add(request.identifier);

      const data = request.content.data ?? {};
      const type = typeof data.type === 'string' ? data.type : '';
      const sessionId = typeof data.sessionId === 'string' ? data.sessionId : null;
      const fineId = typeof data.fineId === 'string' ? data.fineId : null;
      const orderId = typeof data.orderId === 'string' ? data.orderId : null;

      if (type === 'fine_created') {
        router.push({ pathname: '/student/fines' as any, params: fineId ? { fineId } : undefined });
      } else if (type === 'payment_success' || type === 'payment_failed') {
        router.push({
          pathname: '/student/payments' as any,
          params: {
            ...(orderId ? { orderId } : {}),
            ...(fineId ? { fineId } : {}),
          },
        });
      } else if (type.startsWith('permission')) {
        router.push('/student/permissions' as any);
      } else if (sessionId && type === 'session_opened') {
        router.push({
          pathname: '/student/attendance/[sessionId]' as any,
          params: { sessionId },
        });
      } else if (sessionId) {
        router.push({ pathname: '/student/session/[sessionId]', params: { sessionId } });
      }

      Notifications.clearLastNotificationResponse();
    };

    const responseSubscription = Notifications.addNotificationResponseReceivedListener(handleResponse);
    const receivedSubscription = Notifications.addNotificationReceivedListener(() => {
      // Handler foreground global menampilkan notifikasi; listener ini tetap terpasang
      // agar siklus penerimaan foreground tercakup pada runtime aplikasi.
    });

    void Notifications.getLastNotificationResponseAsync().then((response) => {
      if (response) handleResponse(response);
    });

    return () => {
      responseSubscription.remove();
      receivedSubscription.remove();
    };
  }, []);

  return null;
}
