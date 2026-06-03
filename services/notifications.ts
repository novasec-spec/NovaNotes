// services/notifications.ts
import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: true,
  }),
});

export async function sendLoveNotification(title: string, body: string) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, sound: true },
    trigger: null, // Send immediately
  });
}

// Call this when you want to surprise her
// sendLoveNotification('Thinking of You 💕', 'Just wanted to say you\'re amazing!');
