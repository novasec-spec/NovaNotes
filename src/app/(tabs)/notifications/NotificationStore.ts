// src/app/notifications/NotificationStore.ts
// A durable, app-wide notification log — distinct from InAppNotificationEmitter
// in notifications.ts, which only relays *live* events to whatever's mounted
// at that moment. This store is what the Notifications tab actually reads:
// every notification that's ever arrived, persisted to AsyncStorage, browsable
// even if the app was closed when it came in.
//
// Two kinds of producers feed this store:
//  1. Chat notifications — wired in automatically via notifications.ts's
//     response/received listeners (see the integration note at the bottom).
//  2. System notifications — call `logSystemNotification(...)` from anywhere
//     (SyncManager success/error paths in notes.tsx, memories.tsx, moodmusic.tsx,
//     a backup-complete handler, etc).
import AsyncStorage from '@react-native-async-storage/async-storage';

const STORE_KEY = 'app_notification_log';
const MAX_STORED = 300; // oldest beyond this are dropped to keep storage bounded

export type NotificationKind =
  | 'chat_message'
  | 'backup_complete'
  | 'backup_failed'
  | 'restore_complete'
  | 'sync_error'
  | 'reminder'
  | 'system';

export interface AppNotification {
  id: string;
  kind: NotificationKind;
  title: string;
  body: string;
  createdAt: string;
  read: boolean;
  // Routing/context — only the fields relevant to `kind` will be set.
  chatId?: string;
  senderId?: string;
  senderName?: string;
  senderAvatar?: string;
  messageId?: string;
  screen?: string; // for system notifications: which screen to deep-link to, e.g. '/notes'
  meta?: Record<string, any>;
}

type Listener = (notifications: AppNotification[]) => void;

class NotificationStoreImpl {
  private cache: AppNotification[] | null = null;
  private listeners: Listener[] = [];
  private loadPromise: Promise<AppNotification[]> | null = null;

  // ── Subscribe for live updates (badge counts, the list screen, etc) ──────
  subscribe(listener: Listener): () => void {
    this.listeners.push(listener);
    // Push current state immediately so subscribers don't wait for the next change.
    this.getAll().then(listener);
    return () => {
      this.listeners = this.listeners.filter(l => l !== listener);
    };
  }

  private notify() {
    if (!this.cache) return;
    this.listeners.forEach(l => {
      try {
        l(this.cache!);
      } catch (e) {
        console.error('NotificationStore listener error:', e);
      }
    });
  }

  private async load(): Promise<AppNotification[]> {
    if (this.cache) return this.cache;
    if (this.loadPromise) return this.loadPromise;

    this.loadPromise = (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORE_KEY);
        this.cache = raw ? JSON.parse(raw) : [];
      } catch (e) {
        console.error('NotificationStore load error:', e);
        this.cache = [];
      }
      return this.cache;
    })();

    return this.loadPromise;
  }

  private async persist() {
    if (!this.cache) return;
    try {
      await AsyncStorage.setItem(STORE_KEY, JSON.stringify(this.cache));
    } catch (e) {
      console.error('NotificationStore persist error:', e);
    }
  }

  async getAll(): Promise<AppNotification[]> {
    const all = await this.load();
    // Newest first.
    return [...all].sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  async getUnreadCount(): Promise<number> {
    const all = await this.load();
    return all.filter(n => !n.read).length;
  }

  async add(notification: Omit<AppNotification, 'id' | 'createdAt' | 'read'> & { id?: string }): Promise<AppNotification> {
    await this.load();
    const entry: AppNotification = {
      id: notification.id ?? `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`,
      createdAt: new Date().toISOString(),
      read: false,
      ...notification,
    };

    this.cache = [entry, ...(this.cache ?? [])].slice(0, MAX_STORED);
    await this.persist();
    this.notify();
    return entry;
  }

  async markRead(id: string) {
    await this.load();
    this.cache = (this.cache ?? []).map(n => n.id === id ? { ...n, read: true } : n);
    await this.persist();
    this.notify();
  }

  async markAllRead() {
    await this.load();
    this.cache = (this.cache ?? []).map(n => ({ ...n, read: true }));
    await this.persist();
    this.notify();
  }

  async remove(id: string) {
    await this.load();
    this.cache = (this.cache ?? []).filter(n => n.id !== id);
    await this.persist();
    this.notify();
  }

  async clearAll() {
    this.cache = [];
    await this.persist();
    this.notify();
  }

  // Avoid duplicate chat-message entries if both the received-listener and a
  // realtime INSERT handler somehow both try to log the same message.
  async existsForMessage(messageId: string): Promise<boolean> {
    const all = await this.load();
    return all.some(n => n.messageId === messageId);
  }
}

export const NotificationStore = new NotificationStoreImpl();

// ── Convenience helper for system/app notifications ─────────────────────────
// Call this from anywhere in the app — sync managers, reminder schedulers,
// error boundaries — to log something the user should be able to see and
// review later in the Notifications tab.
export async function logSystemNotification(params: {
  kind: NotificationKind;
  title: string;
  body: string;
  screen?: string;
  meta?: Record<string, any>;
}) {
  return NotificationStore.add(params);
}

// ── Convenience helper for chat notifications ────────────────────────────────
export async function logChatNotification(params: {
  chatId: string;
  senderId: string;
  senderName?: string;
  senderAvatar?: string;
  messageId?: string;
  preview: string;
}) {
  if (params.messageId && await NotificationStore.existsForMessage(params.messageId)) {
    return null; // already logged — avoid duplicates from overlapping listeners
  }
  return NotificationStore.add({
    kind: 'chat_message',
    title: params.senderName || 'New message',
    body: params.preview,
    chatId: params.chatId,
    senderId: params.senderId,
    senderName: params.senderName,
    senderAvatar: params.senderAvatar,
    messageId: params.messageId,
  });
}
