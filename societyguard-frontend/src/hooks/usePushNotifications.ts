"use client";

import { useState, useEffect } from 'react';
import api from '@/lib/api';
import { toast } from 'sonner';

function urlBase64ToUint8Array(base64String: string) {
  const padding = '='.repeat((4 - base64String.length % 4) % 4);
  const base64 = (base64String + padding)
    .replace(/\-/g, '+')
    .replace(/_/g, '/');

  const rawData = window.atob(base64);
  const outputArray = new Uint8Array(rawData.length);

  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i);
  }
  return outputArray;
}

export function usePushNotifications() {
  const [isSupported, setIsSupported] = useState(false);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);

  useEffect(() => {
    if ('serviceWorker' in navigator && 'PushManager' in window) {
      setIsSupported(true);
      registerServiceWorker();
    }
  }, []);

  const registerServiceWorker = async () => {
    try {
      await navigator.serviceWorker.register('/sw.js', {
        scope: '/',
        updateViaCache: 'none',
      });
      // Check if already subscribed
      const registration = await navigator.serviceWorker.ready;
      const sub = await registration.pushManager.getSubscription();
      if (sub) {
        setSubscription(sub);
      }
    } catch (err) {
      console.error('Service Worker registration failed:', err);
    }
  };

  const subscribe = async () => {
    if (!isSupported) {
      toast.error("Push notifications are not supported in this browser");
      return false;
    }

    try {
      const permission = await Notification.requestPermission();
      if (permission !== 'granted') {
        toast.error("You need to grant permission to receive notifications");
        return false;
      }

      const registration = await navigator.serviceWorker.ready;
      
      const publicVapidKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
      if (!publicVapidKey) {
        console.error("VAPID public key not found in environment");
        return false;
      }

      const sub = await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicVapidKey)
      });

      setSubscription(sub);

      // Send to backend
      await api.post('/notifications/subscribe', sub.toJSON());
      
      toast.success("Push notifications enabled!");
      return true;
    } catch (err) {
      console.error("Failed to subscribe to push notifications", err);
      toast.error("Failed to enable notifications");
      return false;
    }
  };

  const unsubscribe = async () => {
    try {
      if (subscription) {
        // Send to backend to remove
        await api.delete('/notifications/unsubscribe', {
          data: { endpoint: subscription.endpoint }
        });
        
        await subscription.unsubscribe();
        setSubscription(null);
        toast.success("Push notifications disabled");
      }
    } catch (err) {
      console.error("Failed to unsubscribe", err);
    }
  };

  return {
    isSupported,
    subscription,
    isSubscribed: !!subscription,
    subscribe,
    unsubscribe
  };
}
