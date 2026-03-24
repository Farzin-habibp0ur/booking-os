'use client';

import { useEffect, useRef } from 'react';
import { useCapacitor } from './useCapacitor';
import { api } from '@/lib/api';

export function usePushNotifications() {
  const { isNative, platform } = useCapacitor();
  const registered = useRef(false);

  useEffect(() => {
    if (!isNative || registered.current) return;

    async function setup() {
      try {
        const { PushNotifications } = await import('@capacitor/push-notifications');

        const permResult = await PushNotifications.requestPermissions();
        if (permResult.receive !== 'granted') return;

        await PushNotifications.register();

        await PushNotifications.addListener('registration', async (token) => {
          registered.current = true;
          try {
            await api.post('/device-tokens', {
              token: token.value,
              platform,
            });
          } catch (err) {
            console.error('Failed to register device token:', err);
          }
        });

        await PushNotifications.addListener('registrationError', (err) => {
          console.error('Push registration failed:', err);
        });

        await PushNotifications.addListener('pushNotificationReceived', (notification) => {
          // Foreground notification — could show an in-app indicator
          console.log('Push received (foreground):', notification);
        });

        await PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          const data = action.notification.data;
          if (data?.conversationId) {
            window.location.href = `/inbox?conversation=${data.conversationId}`;
          } else if (data?.bookingId) {
            window.location.href = `/bookings?id=${data.bookingId}`;
          }
        });
      } catch (err) {
        // Not in Capacitor context or push not supported
        console.debug('Push notifications not available:', err);
      }
    }

    setup();

    return () => {
      import('@capacitor/push-notifications').then(({ PushNotifications }) => {
        PushNotifications.removeAllListeners();
      }).catch(() => {});
    };
  }, [isNative, platform]);
}
