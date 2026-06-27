// types/index.ts
export interface VoiceNote {
  uri: string;
  duration: number;
  timestamp: string;
  fileName?: string;
}

export interface Note {
  id: string;
  title: string;
  text: string;
  place?: string;
  event?: string;
  author?: string;
  tags?: string[];
  themeIndex: number;
  moodIndex: number | null;
  stickerIndex: number | null;
  photoUri?: string;
  photoFileName?: string;
  bgPhotoUri?: string;
  bgPhotoFileName?: string;
  hasDoodle: boolean;
  doodleData?: string;
  doodleFileName?: string;
  voiceNote?: VoiceNote;
  voiceFileName?: string;
  createdAt: string;
  updatedAt: string;
  pinned: boolean;
  fav: boolean;
  archived?: boolean;
  _synced?: boolean;
  _localOnly?: boolean;
  location?: LocationData;
  readTime?: number;
  template?: string;
  version?: number;
  history?: NoteVersion[];
  folderId?: string;
  isEncrypted?: boolean;
  sharedWith?: string[];
  reminderRecurring?: RecurringReminder;
  weather?: WeatherData;
  writingPrompt?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  address?: string;
  placeName?: string;
  city?: string;
  country?: string;
}

export interface NoteVersion {
  id: string;
  content: string;
  createdAt: string;
  version: number;
}

export interface RecurringReminder {
  frequency: 'daily' | 'weekly' | 'monthly';
  time: string;
  daysOfWeek?: number[];
  dayOfMonth?: number;
  lastTriggered?: string;
}

export interface WeatherData {
  temperature: number;
  condition: string;
  icon: string;
  humidity?: number;
  windSpeed?: number;
}

export interface Folder {
  id: string;
  name: string;
  color: string;
  icon: string;
  noteIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface NoteStats {
  totalNotes: number;
  totalWords: number;
  mostUsedTags: { tag: string; count: number }[];
  writingStreak: number;
  avgNotesPerDay: number;
  moodDistribution: { mood: string; count: number }[];
  topLocations: { place: string; count: number }[];
  notesByMonth: { month: string; count: number }[];
}

export interface StreakData {
  currentStreak: number;
  longestStreak: number;
  lastWrittenDate: string;
  history: { date: string; count: number }[];
}

export interface Migration {
  version: number;
  up: (notes: Note[]) => Note[];
  down: (notes: Note[]) => Note[];
}

export type SyncStatus = 'idle' | 'syncing' | 'synced' | 'offline' | 'error';

export interface Theme {
  bg: string;
  accent: string;
  name: string;
  darkBg: string;
  darkAccent: string;
}

export interface MoodOption {
  label: string;
  icon: string;
  color: string;
}

export interface StickerOption {
  name: string;
  color: string;
}

export const NOTE_TEMPLATES = {
  journal: { 
    id: 'journal', 
    title: 'Daily Journal', 
    text: 'Today I felt...\n\nI accomplished...\n\nI am grateful for...' 
  },
  gratitude: { 
    id: 'gratitude', 
    title: 'Gratitude', 
    text: 'I am grateful for...\n\n1. \n2. \n3.' 
  },
  dream: { 
    id: 'dream', 
    title: 'Dream Journal', 
    text: 'Last night I dreamed...\n\nI felt...\n\nI think this means...' 
  },
  idea: { 
    id: 'idea', 
    title: 'Idea', 
    text: 'My idea:\n\nWhat problem does it solve?\n\nWho is it for?\n\nNext steps:' 
  },
  prayer: { 
    id: 'prayer', 
    title: 'Prayer', 
    text: 'Dear God,\n\nI come to you with...\n\nI ask for...\n\nI thank you for...\n\nAmen.' 
  },
  love: { 
    id: 'love', 
    title: 'Love Letter', 
    text: 'My dearest,\n\nI wanted to tell you...\n\nYou make me feel...\n\nI am grateful for...' 
  },
  goals: { 
    id: 'goals', 
    title: 'Goals', 
    text: 'My goals:\n\n1. \n2. \n3.\n\nWhy these matter:\n\nAction steps:' 
  }
};
