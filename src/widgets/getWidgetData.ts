// src/widgets/getWidgetData.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyQuote } from './quotes';
import { STORAGE_KEYS, MOOD_EMOJI } from './widgetStorageKeys';

export interface WidgetData {
  quoteText: string;
  quoteAuthor: string;
  streak: number;
  moodEmoji: string | null;
  loveNote: string | null;
  dateLabel: string;
}

interface NoteRecord {
  id: string;
  text: string;
  createdAt: string;
}

interface MoodRecord {
  date: string; // YYYY-MM-DD
  mood: string;
}

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/** Counts consecutive days (ending today or yesterday) that have at least one note OR mood entry. */
function computeStreak(notes: NoteRecord[], moods: MoodRecord[]): number {
  const activeDays = new Set<string>();
  notes.forEach((n) => {
    if (n?.createdAt) activeDays.add(n.createdAt.slice(0, 10));
  });
  moods.forEach((m) => {
    if (m?.date) activeDays.add(m.date);
  });

  let streak = 0;
  const cursor = new Date();

  // If today has no activity yet, streak still counts from yesterday
  // backwards (so writing a note later today doesn't reset it to 0).
  if (!activeDays.has(toDateKey(cursor))) {
    cursor.setDate(cursor.getDate() - 1);
  }

  while (activeDays.has(toDateKey(cursor))) {
    streak += 1;
    cursor.setDate(cursor.getDate() - 1);
  }

  return streak;
}

async function readJSON<T>(key: string, fallback: T): Promise<T> {
  try {
    const raw = await AsyncStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch (error) {
    console.warn(`⚠️ Widget: failed reading ${key}`, error);
    return fallback;
  }
}

export async function getWidgetData(): Promise<WidgetData> {
  const [notes, moods, streakOverride, loveNote] = await Promise.all([
    readJSON<NoteRecord[]>(STORAGE_KEYS.NOTES, []),
    readJSON<MoodRecord[]>(STORAGE_KEYS.MOODS, []),
    AsyncStorage.getItem(STORAGE_KEYS.STREAK_OVERRIDE),
    AsyncStorage.getItem(STORAGE_KEYS.LOVE_NOTE),
  ]);

  const todayKey = toDateKey(new Date());
  const todaysMood = moods.find((m) => m.date === todayKey)?.mood ?? null;
  const quote = getDailyQuote();

  return {
    quoteText: quote.text,
    quoteAuthor: quote.author,
    streak: streakOverride ? parseInt(streakOverride, 10) || 0 : computeStreak(notes, moods),
    moodEmoji: todaysMood ? MOOD_EMOJI[todaysMood] ?? null : null,
    loveNote: loveNote || null,
    dateLabel: new Date().toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }),
  };
}
