// src/app/(tabs)/faith/types.ts
export interface BibleVerse {
  reference: string;
  text: string;
  translation: string;
  verses: Array<{ verse: number; text: string }>;
}

export interface PrayerRequest {
  id: string;
  title: string;
  description: string;
  date: string;
  answered: boolean;
  answerDate?: string;
  answerDescription?: string;
  privacy: 'public' | 'private';
  category: 'personal' | 'family' | 'church' | 'world' | 'other';
}

export interface SermonNote {
  id: string;
  title: string;
  church: string;
  preacher: string;
  date: string;
  scripture: string[];
  notes: string;
  keyTakeaways: string[];
  rating: 1 | 2 | 3 | 4 | 5;
}

export interface PraiseReport {
  id: string;
  title: string;
  description: string;
  date: string;
  category: 'answered-prayer' | 'blessing' | 'testimony' | 'miracle' | 'healing' | 'provision';
  mood: string;
}

export interface Hymn {
  id: string;
  title: string;
  lyrics: string;
  author: string;
  meter: string;
  tune: string;
  chorus?: string;
}

export interface WorshipSong {
  id: string;
  title: string;
  artist: string;
  album: string;
  lyrics: string;
  chords: string;
  key: string;
  tempo: number;
}

export type FaithTab = 'home' | 'bible' | 'prayer' | 'sermon' | 'praise' | 'lyrics';
