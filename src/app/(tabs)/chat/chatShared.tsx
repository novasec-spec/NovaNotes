// ─────────────────────────────────────────────────────────────────────────────
//  chatShared.tsx — constants, types, message reducer, and pure helpers
//  used across the chat screen files.
// ─────────────────────────────────────────────────────────────────────────────
import * as Haptics from 'expo-haptics';
import * as FileSystem from 'expo-file-system/legacy';
import { supabase } from '../../../config/supabase';
import { User, Message } from './types';

// ── Colors & layout constants ───────────────────────────────────────────────
export const PINK = '#FF6B9D';
export const PINK_DARK = '#E84F86';
export const WHITE = '#FFFFFF';
export const SUCCESS = '#22C55E';
export const DANGER = '#EF4444';
export const GREY = '#94A3B8';
export const BLUE = '#3B82F6';
export const PURPLE = '#8B5CF6';
export const ORANGE = '#F59E0B';
export const GRADIENT = [PINK, PINK_DARK] as const;

export const TYPING_TIMEOUT_MS = 3000;
export const NEAR_BOTTOM_THRESHOLD = 120;
export const MESSAGES_PER_PAGE = 50;
export const EDIT_WINDOW_MS = 15 * 60 * 1000;
export const TAB_BAR_HEIGHT = 80;

// ── Reaction set ───────────────────────────────────────────────────────────
export const REACTIONS = ['❤️', '😂', '😮', '😢', '👍', '🔥', '🙏', '🥹', '💯', '🎉'];

// ── Types ────────────────────────────────────────────────────────────────────
export interface Reaction {
  emoji: string;
  userId: string;
  timestamp: string;
}

export interface ChatMessage extends Message {
  _optimisticId?: string;
  _sendStatus?: 'sending' | 'sent' | 'failed' | 'queued';
  _localImageUri?: string;
  _localAudioUri?: string;
  _localVideoUri?: string;
  replyTo?: ChatMessage;
  reactions?: Reaction[];
  isEdited?: boolean;
  editedAt?: string;
  isStarred?: boolean;
  deletedFor?: string[];
  seenAt?: string;
}

// ── Reducer ───────────────────────────────────────────────────────────────
export type MsgAction =
  | { type: 'SET'; payload: ChatMessage[] }
  | { type: 'ADD'; payload: ChatMessage }
  | { type: 'UPDATE'; payload: { id: string; updates: Partial<ChatMessage> } }
  | { type: 'DELETE'; payload: { id: string; forAll: boolean; uid: string } }
  | { type: 'REACT'; payload: { messageId: string; reaction: Reaction } }
  | { type: 'UNREACT'; payload: { messageId: string; uid: string; emoji: string } }
  | { type: 'STAR'; payload: { id: string; starred: boolean } }
  | { type: 'REPLACE_OPTIMISTIC'; payload: { oid: string; real: ChatMessage } }
  | { type: 'PREPEND'; payload: ChatMessage[] }
  | { type: 'BULK_DELETE'; payload: string[] };

export function msgReducer(state: ChatMessage[], action: MsgAction): ChatMessage[] {
  switch (action.type) {
    case 'SET': return action.payload;
    case 'PREPEND': return [...action.payload, ...state];
    case 'ADD': return [...state, action.payload];
    case 'UPDATE':
      return state.map(m => m.id === action.payload.id ? { ...m, ...action.payload.updates } : m);
    case 'DELETE':
      return state.map(m => {
        if (m.id !== action.payload.id) return m;
        if (action.payload.forAll) {
          return { ...m, text: 'This message was deleted', image_url: undefined, audio_url: undefined, video_url: undefined, file_url: undefined, deletedFor: ['all'] };
        }
        return { ...m, deletedFor: [...(m.deletedFor ?? []), action.payload.uid] };
      });
    case 'BULK_DELETE':
      return state.filter(m => !action.payload.includes(m.id));
    case 'REACT': {
      return state.map(m => {
        if (m.id !== action.payload.messageId) return m;
        const prev = (m.reactions ?? []).filter(r => !(r.userId === action.payload.reaction.userId && r.emoji === action.payload.reaction.emoji));
        return { ...m, reactions: [...prev, action.payload.reaction] };
      });
    }
    case 'UNREACT':
      return state.map(m => m.id !== action.payload.messageId ? m : {
        ...m,
        reactions: (m.reactions ?? []).filter(r => !(r.userId === action.payload.uid && r.emoji === action.payload.emoji)),
      });
    case 'STAR':
      return state.map(m => m.id === action.payload.id ? { ...m, isStarred: action.payload.starred } : m);
    case 'REPLACE_OPTIMISTIC':
      return state.map(m => m._optimisticId === action.payload.oid ? action.payload.real : m);
    default: return state;
  }
}

// ── Helpers ──────────────────────────────────────────────────────────────
export function genId() { return `local_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`; }
export function fmtTime(t: string) { return new Date(t).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }); }
export function fmtDur(s: number) { return `${Math.floor(s / 60)}:${Math.floor(s % 60).toString().padStart(2, '0')}`; }

export function fmtDateSep(d: string) {
  const date = new Date(d);
  const now = new Date();
  const yest = new Date(now); yest.setDate(now.getDate() - 1);
  if (date.toDateString() === now.toDateString()) return 'Today';
  if (date.toDateString() === yest.toDateString()) return 'Yesterday';
  return date.toLocaleDateString([], { month: 'long', day: 'numeric' });
}

export function haptic(k: 'light' | 'medium' | 'heavy' | 'success' | 'error' | 'selection') {
  try {
    if (k === 'success') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    else if (k === 'error') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
    else if (k === 'selection') Haptics.selectionAsync();
    else Haptics.impactAsync(
      k === 'heavy' ? Haptics.ImpactFeedbackStyle.Heavy :
        k === 'medium' ? Haptics.ImpactFeedbackStyle.Medium :
          Haptics.ImpactFeedbackStyle.Light
    );
  } catch { /* unsupported */ }
}

export function isUrl(text: string) {
  return /https?:\/\/[^\s]+/.test(text);
}

export function getInitials(name?: string): string {
  if (!name) return '?';
  return name.trim().split(/\s+/).map(w => w[0]).join('').toUpperCase().slice(0, 2);
}

export function avatarColor(id: string): string {
  const COLORS = ['#FF6B9D', '#A855F7', '#22C55E', '#F59E0B', '#3B82F6', '#F97316', '#EC4899', '#06B6D4'];
  let hash = 0;
  for (let i = 0; i < id.length; i++) hash = id.charCodeAt(i) + ((hash << 5) - hash);
  return COLORS[Math.abs(hash) % COLORS.length];
}

// ── Upload helper ──────────────────────────────────────────────────────────
export async function uploadToStorage(uri: string, folder: string, mime: string): Promise<string | null> {
  try {
    const ext = uri.split('.').pop()?.split('?')[0] ?? 'bin';
    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}.${ext}`;
    const base64 = await FileSystem.readAsStringAsync(uri, { encoding: FileSystem.EncodingType.Base64 });

    const raw = atob(base64);
    const arr = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) arr[i] = raw.charCodeAt(i);

    const { error } = await supabase.storage.from('chat_media').upload(fileName, arr, {
      contentType: mime,
      upsert: false,
    });
    if (error) throw error;

    const { data } = supabase.storage.from('chat_media').getPublicUrl(fileName);
    return data.publicUrl;
  } catch (e) {
    console.error('[Chat] upload error:', e);
    return null;
  }
}

export type { User, Message };
