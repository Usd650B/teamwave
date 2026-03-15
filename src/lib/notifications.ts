import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth } from '@/lib/firebase/firebase';

// Request notification permission
export const requestNotificationPermission = async (): Promise<boolean> => {
  if ('Notification' in window) {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  }
  return false;
};

// Save FCM token to Firestore
export const saveNotificationToken = async () => {
  try {
    const user = auth.currentUser;
    if (!user) return;

    const token = await getToken(getMessaging());
    if (token) {
      await updateDoc(doc(db, 'users', user.uid), {
        fcmToken: token,
        tokenUpdatedAt: serverTimestamp()
      });
    }
  } catch (error) {
    console.error('Error saving notification token:', error);
  }
};

// Handle foreground messages
export const onForegroundMessage = () => {
  return onMessage(getMessaging(), async (payload: any) => {
  console.log('Received foreground message:', payload);
  
  if (payload.notification) {
    // Show notification for foreground messages
    const notificationTitle = payload.notification.title || 'New Message';
    const notificationOptions: NotificationOptions = {
      body: payload.notification.body,
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      tag: payload.data?.messageId || 'new-message'
    };

    // Show browser notification
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

    // Request permission first
    const hasPermission = await requestNotificationPermission();
    if (!hasPermission) {
      console.log('Notification permission denied');
      return;
    }

    // Save token
    await saveNotificationToken();
    
    console.log('Firebase Cloud Messaging initialized');
  } catch (error) {
    console.error('Error initializing messaging:', error);
  }
};
