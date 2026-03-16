import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebase';
import app from '@/lib/firebase/firebase';

// Get messaging instance (only in browser, not SSR)
const getMessagingInstance = () => {
  if (typeof window === 'undefined') return null;
  try {
    return getMessaging(app);
  } catch (e) {
    console.warn('Firebase messaging not available:', e);
    return null;
  }
};

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if (!('Notification' in window)) return false;
  const permission = await Notification.requestPermission();
  return permission === 'granted';
};

// Save FCM token to Firestore
export const saveNotificationToken = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const messaging = getMessagingInstance();
    if (!messaging) return;

    const token = await getToken(messaging);
    if (token) {
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token,
        tokenUpdatedAt: serverTimestamp(),
      });
    }
  } catch (error) {
    console.error('Error saving notification token:', error);
  }
};

// Handle foreground messages
export const onForegroundMessage = () => {
  const messaging = getMessagingInstance();
  if (!messaging) return () => {};

  return onMessage(messaging, (payload: any) => {
    console.log('Received foreground message:', payload);

    if (payload.notification) {
      const notificationTitle = payload.notification.title || 'New Message';
      const notificationOptions: NotificationOptions = {
        body: payload.notification.body,
        icon: '/favicon.ico',
        badge: '/favicon.ico',
        tag: payload.data?.messageId || 'new-message',
      };

      if ('Notification' in window && Notification.permission === 'granted') {
        new Notification(notificationTitle, notificationOptions);
      }
    }
  });
};

// Initialize messaging
export const initializeMessaging = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return;
    }

    await saveNotificationToken();
    console.log('Firebase Cloud Messaging initialized');
  } catch (error) {
    console.error('Error initializing messaging:', error);
  }
};
