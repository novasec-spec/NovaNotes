// utils/constants.ts
import { Theme, MoodOption, StickerOption } from '../types';

export const PINK = '#FF6B9D';
export const BG = '#FFF5F7';
export const WHITE = '#FFFFFF';
export const TEXT_DARK = '#3A1A2E';
export const TEXT_MID = '#9A7090';
export const TEXT_SOFT = '#C4A0B8';
export const SUCCESS = '#22C55E';
export const WARNING = '#F59E0B';
export const DANGER = '#EF4444';
export const MAX_CHARS = 4000;

export const NOTE_THEMES: Theme[] = [
  { bg: '#FFD6E8', accent: '#FF6B9D', name: 'Rose', darkBg: '#3A1A2E', darkAccent: '#FF6B9D' },
  { bg: '#E8D6FF', accent: '#A855F7', name: 'Lavender', darkBg: '#2A1A3E', darkAccent: '#A855F7' },
  { bg: '#D6F5E8', accent: '#22C55E', name: 'Mint', darkBg: '#1A2A22', darkAccent: '#22C55E' },
  { bg: '#FFF3D6', accent: '#F59E0B', name: 'Honey', darkBg: '#2A221A', darkAccent: '#F59E0B' },
  { bg: '#FFE8D6', accent: '#F97316', name: 'Peach', darkBg: '#2A1A12', darkAccent: '#F97316' },
  { bg: '#D6EEFF', accent: '#3B82F6', name: 'Sky', darkBg: '#1A222A', darkAccent: '#3B82F6' },
  { bg: '#FFE0EC', accent: '#DB2777', name: 'Blush', darkBg: '#33141F', darkAccent: '#F472B6' },
  { bg: '#E0F2FE', accent: '#0EA5E9', name: 'Ocean', darkBg: '#142733', darkAccent: '#38BDF8' },
  { bg: '#1F2937', accent: '#F472B6', name: 'Midnight', darkBg: '#11151C', darkAccent: '#F472B6' },
];

export const MOOD_OPTIONS: MoodOption[] = [
  { label: 'Happy', icon: 'happy-outline', color: '#F59E0B' },
  { label: 'Soft', icon: 'heart-outline', color: '#FF6B9D' },
  { label: 'Dreamy', icon: 'moon-outline', color: '#A855F7' },
  { label: 'Grateful', icon: 'sparkles-outline', color: '#22C55E' },
  { label: 'Thinking', icon: 'bulb-outline', color: '#3B82F6' },
  { label: 'Chaotic', icon: 'flame-outline', color: '#F97316' },
  { label: 'Sad', icon: 'rainy-outline', color: '#60A5FA' },
  { label: 'Angry', icon: 'thunderstorm-outline', color: '#EF4444' },
  { label: 'Love', icon: 'rose-outline', color: '#EC4899' },
  { label: 'Chill', icon: 'leaf-outline', color: '#10B981' },
];

export const STICKER_OPTIONS: StickerOption[] = [
  { name: 'flower', color: '#FF6B9D' },
  { name: 'star-four-points', color: '#F59E0B' },
  { name: 'butterfly', color: '#A855F7' },
  { name: 'heart', color: '#EF4444' },
  { name: 'emoticon-outline', color: '#3B82F6' },
  { name: 'leaf', color: '#22C55E' },
  { name: 'lightning-bolt', color: '#F97316' },
  { name: 'music-note', color: '#EC4899' },
  { name: 'snowflake', color: '#60A5FA' },
  { name: 'crown', color: '#F59E0B' },
  { name: 'pizza', color: '#F97316' },
  { name: 'coffee', color: '#92400E' },
];

export const TAG_SUGGESTIONS = ['us', 'date night', 'milestone', 'travel', 'gratitude', 'goals', 'inside joke'];

export const REMINDER_OPTIONS = [
  { label: 'In 5 minutes', icon: 'time-outline', minutes: 5 },
  { label: 'In 30 minutes', icon: 'time-outline', minutes: 30 },
  { label: 'In 1 hour', icon: 'alarm-outline', minutes: 60 },
  { label: 'In 3 hours', icon: 'alarm-outline', minutes: 180 },
  { label: 'Tonight (8 hours)', icon: 'moon-outline', minutes: 480 },
  { label: 'Tomorrow morning', icon: 'sunny-outline', minutes: 600 },
  { label: 'Custom', icon: 'time-outline', minutes: 0 },
];

export const DOODLE_COLORS = ['#FF6B9D', '#A855F7', '#22C55E', '#3B82F6', '#F59E0B', '#1A1A1A', '#FFFFFF'];

export const STORAGE_KEYS = {
  NOTES: 'notes_data',
  METADATA: 'notes_metadata',
  ARCHIVE: 'notes_archive',
  TRASH: 'notes_trash',
  DEVICE_ID: 'notes_device_owner_id',
  LAST_BACKUP: 'notes_last_backup_at',
  LAST_REMINDER: 'lastDailyReminder',
  FOLDERS: 'notes_folders',
  STATS: 'notes_stats',
  STREAK: 'notes_streak',
  ENCRYPTION_KEY: 'notes_encryption_key',
} as const;

export const BUCKET_NAME = 'notes-bucket';

export const FOLDER_COLORS = ['#FF6B9D', '#A855F7', '#22C55E', '#3B82F6', '#F59E0B', '#EF4444', '#10B981', '#8B5CF6'];

export const FOLDER_ICONS = ['folder', 'folder-open', 'heart', 'star', 'book', 'music', 'camera', 'cloud'];

export const QUICK_ACTIONS = [
  { icon: 'pin', label: 'Pin', color: '#FF6B9D' },
  { icon: 'heart', label: 'Favorite', color: '#EF4444' },
  { icon: 'archive', label: 'Archive', color: '#8B5CF6' },
  { icon: 'share', label: 'Share', color: '#3B82F6' },
  { icon: 'trash', label: 'Delete', color: '#EF4444' },
];

export const AUTO_SAVE_INTERVAL = 30000;
