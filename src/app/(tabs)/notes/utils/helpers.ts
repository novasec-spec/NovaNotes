// utils/helpers.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import * as Location from 'expo-location';
import { STORAGE_KEYS, MOOD_OPTIONS } from './constants';
import { Note, NoteStats, StreakData, WeatherData, Migration } from '../types';

export function smartDate(dateStr: string): string {
  const d = new Date(dateStr);
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);
  if (d.toDateString() === today.toDateString()) return 'Today';
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function timeAgo(dateStr: string | null): string {
  if (!dateStr) return 'Never';
  const seconds = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (seconds < 60) return 'Just now';
  const mins = Math.floor(seconds / 60);
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export function wordCount(str: string): number {
  return str.trim().split(/\s+/).filter(Boolean).length;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
}

export function generateId(): string {
  return `${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
}

export async function getDeviceOwnerId(): Promise<string> {
  let id = await AsyncStorage.getItem(STORAGE_KEYS.DEVICE_ID);
  if (!id) {
    id = generateId();
    await AsyncStorage.setItem(STORAGE_KEYS.DEVICE_ID, id);
  }
  return id;
}

export const LOCAL_FILES_DIR = FileSystem.documentDirectory + 'notes_media/';

export async function ensureLocalDir() {
  try {
    const info = await FileSystem.getInfoAsync(LOCAL_FILES_DIR);
    if (!info.exists) {
      await FileSystem.makeDirectoryAsync(LOCAL_FILES_DIR, { intermediates: true });
      console.log(`📁 Created directory: ${LOCAL_FILES_DIR}`);
    }
  } catch (e) {
    console.error('ensureLocalDir error:', e);
  }
}

export function getReadTime(text: string): number {
  const wordsPerMinute = 200;
  const wordCount = text.trim().split(/\s+/).length;
  return Math.ceil(wordCount / wordsPerMinute);
}

export function searchNotes(notes: Note[], query: string, filters?: {
  tags?: string[];
  dateRange?: { from: Date; to: Date };
  mood?: string;
  hasMedia?: boolean;
  isPinned?: boolean;
  isFav?: boolean;
  folderId?: string;
}): Note[] {
  let results = notes;
  
  if (query.trim()) {
    const q = query.toLowerCase();
    results = results.filter(n =>
      (n.title || '').toLowerCase().includes(q) ||
      (n.text || '').toLowerCase().includes(q) ||
      (n.place || '').toLowerCase().includes(q) ||
      (n.event || '').toLowerCase().includes(q) ||
      (n.tags || []).some(t => t.toLowerCase().includes(q)) ||
      (n.author || '').toLowerCase().includes(q)
    );
  }
  
  if (filters) {
    if (filters.tags && filters.tags.length > 0) {
      results = results.filter(n => 
        filters.tags!.some(t => (n.tags || []).includes(t))
      );
    }
    if (filters.dateRange) {
      results = results.filter(n => {
        const date = new Date(n.createdAt);
        return date >= filters.dateRange!.from && date <= filters.dateRange!.to;
      });
    }
    if (filters.mood) {
      const moodIndex = MOOD_OPTIONS.findIndex(m => m.label === filters.mood);
      results = results.filter(n => n.moodIndex === moodIndex);
    }
    if (filters.hasMedia !== undefined) {
      results = results.filter(n => 
        filters.hasMedia ? !!(n.photoUri || n.voiceNote) : !(n.photoUri || n.voiceNote)
      );
    }
    if (filters.isPinned !== undefined) {
      results = results.filter(n => n.pinned === filters.isPinned);
    }
    if (filters.isFav !== undefined) {
      results = results.filter(n => n.fav === filters.isFav);
    }
    if (filters.folderId) {
      results = results.filter(n => n.folderId === filters.folderId);
    }
  }
  
  return results;
}

export function calculateStats(notes: Note[]): NoteStats {
  const totalWords = notes.reduce((sum, n) => sum + wordCount(n.text), 0);
  
  const tagCount: { [key: string]: number } = {};
  notes.forEach(n => {
    (n.tags || []).forEach(t => {
      tagCount[t] = (tagCount[t] || 0) + 1;
    });
  });
  
  const mostUsedTags = Object.entries(tagCount)
    .map(([tag, count]) => ({ tag, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10);
  
  const moodCount: { [key: string]: number } = {};
  notes.forEach(n => {
    if (n.moodIndex !== null) {
      const mood = MOOD_OPTIONS[n.moodIndex]?.label || 'Unknown';
      moodCount[mood] = (moodCount[mood] || 0) + 1;
    }
  });
  
  const moodDistribution = Object.entries(moodCount)
    .map(([mood, count]) => ({ mood, count }));
  
  const locationCount: { [key: string]: number } = {};
  notes.forEach(n => {
    if (n.place) {
      locationCount[n.place] = (locationCount[n.place] || 0) + 1;
    }
  });
  
  const topLocations = Object.entries(locationCount)
    .map(([place, count]) => ({ place, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5);
  
  const notesByMonth = notes.reduce((acc: { month: string; count: number }[], n) => {
    const month = new Date(n.createdAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
    const existing = acc.find(item => item.month === month);
    if (existing) {
      existing.count++;
    } else {
      acc.push({ month, count: 1 });
    }
    return acc;
  }, []);
  
  return {
    totalNotes: notes.length,
    totalWords,
    mostUsedTags,
    writingStreak: calculateStreak(notes),
    avgNotesPerDay: notes.length > 0 ? notes.length / Math.ceil((Date.now() - new Date(notes[0].createdAt).getTime()) / (1000 * 60 * 60 * 24)) : 0,
    moodDistribution,
    topLocations,
    notesByMonth,
  };
}

export function calculateStreak(notes: Note[]): number {
  if (notes.length === 0) return 0;
  
  const dates = notes.map(n => new Date(n.createdAt).toDateString());
  const uniqueDates = [...new Set(dates)].sort();
  
  if (uniqueDates.length === 0) return 0;
  
  const today = new Date().toDateString();
  let streak = 0;
  
  if (uniqueDates.includes(today)) {
    streak = 1;
    let currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 1);
    while (uniqueDates.includes(currentDate.toDateString())) {
      streak++;
      currentDate.setDate(currentDate.getDate() - 1);
    }
  } else {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    if (uniqueDates.includes(yesterday.toDateString())) {
      streak = 1;
      let currentDate = new Date(yesterday);
      currentDate.setDate(currentDate.getDate() - 1);
      while (uniqueDates.includes(currentDate.toDateString())) {
        streak++;
        currentDate.setDate(currentDate.getDate() - 1);
      }
    }
  }
  
  return streak;
}

export async function getCurrentLocation(): Promise<LocationData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') {
      return null;
    }
    const location = await Location.getCurrentPositionAsync({});
    const [address] = await Location.reverseGeocodeAsync({
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
    });
    return {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      address: address?.formattedAddress,
      placeName: address?.name,
      city: address?.city || address?.subregion,
      country: address?.country,
    };
  } catch (error) {
    console.error('Location error:', error);
    return null;
  }
}

export async function getWeather(lat: number, lon: number): Promise<WeatherData | null> {
  try {
    return {
      temperature: 22 + Math.random() * 10,
      condition: ['Sunny', 'Cloudy', 'Rainy', 'Clear'][Math.floor(Math.random() * 4)],
      icon: 'sunny',
      humidity: 40 + Math.random() * 30,
      windSpeed: 5 + Math.random() * 15,
    };
  } catch (error) {
    console.error('Weather error:', error);
    return null;
  }
}

export const migrations: Migration[] = [
  {
    version: 1,
    up: (notes: Note[]) => notes,
    down: (notes: Note[]) => notes,
  },
  {
    version: 2,
    up: (notes: Note[]) => notes.map(n => ({
      ...n,
      readTime: getReadTime(n.text),
    })),
    down: (notes: Note[]) => notes.map(n => {
      const { readTime, ...rest } = n;
      return rest;
    }),
  },
];

export async function migrateNotes(notes: Note[]): Promise<Note[]> {
  let current = [...notes];
  for (const migration of migrations) {
    current = migration.up(current);
  }
  return current;
}
