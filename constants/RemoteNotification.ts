// constants/RemoteNotification.ts
// AUTO-GENERATED - DO NOT EDIT MANUALLY
// Last updated: 2026-06-08T20:38:21.546Z
// Notification ID: 78c494f20557819f
// Category: note_reminder

export interface RemoteNotification {
  id: string;
  title: string;
  body: string;
  type: string;
  categoryIdentifier: string;
  cooldown?: number;
  sound?: boolean;
  data?: any;
  createdAt: string;
}

export const REMOTE_NOTIFICATION: RemoteNotification | null = {
  id: '78c494f20557819f',
  title: '📝 Note Reminder',
  body: 'Don\'t forget to read: the sweet note I wrote',
  type: 'note_reminder',
  categoryIdentifier: 'note_reminder',
  cooldown: 3600000,
  sound: true,
  data: {"noteTitle":"the sweet note I wrote","noteId":"note_1780951101531"},
  createdAt: '2026-06-08T20:38:21.546Z'
};

export function shouldShowNotification(): boolean {
  try {
    const lastShownKey = 'last_notification_' + (REMOTE_NOTIFICATION?.id || '');
    const lastShown = typeof localStorage !== 'undefined' ? localStorage.getItem(lastShownKey) : null;
    const now = Date.now();
    
    if (lastShown && REMOTE_NOTIFICATION && now - parseInt(lastShown) < (REMOTE_NOTIFICATION.cooldown || 3600000)) {
      return false;
    }
    
    if (typeof localStorage !== 'undefined' && REMOTE_NOTIFICATION) {
      localStorage.setItem(lastShownKey, now.toString());
    }
    
    return true;
  } catch (error) {
    return true;
  }
}
