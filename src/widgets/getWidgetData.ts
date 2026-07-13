// src/widgets/getWidgetData.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getDailyQuote } from './quotes';
import { STORAGE_KEYS, MOOD_EMOJI, MOOD_COLORS } from './widgetStorageKeys';

export interface WidgetData {
  quoteText: string;
  quoteAuthor: string;
  quoteCategory?: string;
  streak: number;
  moodEmoji: string | null;
  moodColor: string | null;
  loveNote: string | null;
  dateLabel: string;
  userName: string;
  unreadCount: number;
  taskCount: number;
  lastBackup: string | null;
  isFresh: boolean;
  dailyAffirmation: string;
  prayerReminder: boolean;
}

interface NoteRecord {
  id: string;
  text: string;
  createdAt: string;
}

interface MoodRecord {
  mood: string;
  timestamp: string;
}

interface TaskRecord {
  id: string;
  title: string;
  completed: boolean;
}

const AFFIRMATIONS = [
  "You are enough — exactly as you are today 🌸",
  "Something wonderful is about to happen to you 💫",
  "You carry more strength than you realise ✨",
  "Your presence makes the world warmer 💕",
  "Today is full of tiny beautiful possibilities 🌼",
  "You are deeply loved, right now, as you are 💝",
];

function toDateKey(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function computeStreak(notes: NoteRecord[], moods: MoodRecord[]): number {
  const activeDays = new Set<string>();
  notes.forEach((n) => {
    if (n?.createdAt) activeDays.add(n.createdAt.slice(0, 10));
  });
  moods.forEach((m) => {
    if (m?.timestamp) activeDays.add(m.timestamp.slice(0, 10));
  });

  let streak = 0;
  const cursor = new Date();

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
  const [
    notes,
    moods,
    streakOverride,
    loveNote,
    userData,
    tasks,
    unreadCount,
    lastBackup,
  ] = await Promise.all([
    readJSON<NoteRecord[]>(STORAGE_KEYS.NOTES, []),
    readJSON<MoodRecord[]>(STORAGE_KEYS.MOODS, []),
    AsyncStorage.getItem(STORAGE_KEYS.STREAK_OVERRIDE),
    AsyncStorage.getItem(STORAGE_KEYS.LOVE_NOTE),
    AsyncStorage.getItem(STORAGE_KEYS.USER_NAME),
    readJSON<TaskRecord[]>(STORAGE_KEYS.TASKS, []),
    AsyncStorage.getItem(STORAGE_KEYS.UNREAD_MESSAGES),
    AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKUP),
  ]);

  const todayKey = toDateKey(new Date());
  
  // Get today's mood
  let todaysMood: string | null = null;
  let todaysMoodColor: string | null = null;
  
  if (moods && moods.length > 0) {
    const todayMoodEntry = moods.find((m) => {
      if (!m?.timestamp) return false;
      return m.timestamp.slice(0, 10) === todayKey;
    });
    if (todayMoodEntry?.mood) {
      todaysMood = todayMoodEntry.mood;
      todaysMoodColor = MOOD_COLORS[todaysMood] || null;
    }
  }

  // Get user name
  let userName = 'Alice';
  if (userData) {
    try {
      const parsed = JSON.parse(userData);
      userName = parsed?.username || parsed?.name || 'Alice';
    } catch {
      userName = userData;
    }
  }

  // Get unread count
  let unread = 0;
  if (unreadCount) {
    unread = parseInt(unreadCount, 10) || 0;
  }

  // Get task count (incomplete tasks)
  const incompleteTasks = tasks ? tasks.filter((t) => !t.completed).length : 0;

  const quote = getDailyQuote();
  const todayDate = new Date();
  const dayOfWeek = todayDate.toLocaleDateString(undefined, { weekday: 'short' });
  const monthDay = todayDate.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });

  return {
    quoteText: quote.text,
    quoteAuthor: quote.author,
    quoteCategory: quote.category || 'love',
    streak: streakOverride ? parseInt(streakOverride, 10) || 0 : computeStreak(notes, moods),
    moodEmoji: todaysMood ? MOOD_EMOJI[todaysMood] ?? null : null,
    moodColor: todaysMoodColor,
    loveNote: loveNote || null,
    dateLabel: `${dayOfWeek}, ${monthDay}`,
    userName: userName,
    unreadCount: unread,
    taskCount: incompleteTasks,
    lastBackup: lastBackup || null,
    isFresh: await isDataFresh(),
    dailyAffirmation: AFFIRMATIONS[new Date().getDate() % AFFIRMATIONS.length],
    prayerReminder: await isPrayerReminderSet(),
  };
}

async function isDataFresh(): Promise<boolean> {
  try {
    const lastUpdate = await AsyncStorage.getItem(STORAGE_KEYS.LAST_WIDGET_UPDATE);
    if (!lastUpdate) return false;
    const diff = Date.now() - parseInt(lastUpdate, 10);
    return diff < 3600000; // 1 hour
  } catch {
    return false;
  }
}

async function isPrayerReminderSet(): Promise<boolean> {
  try {
    const reminders = await AsyncStorage.getItem('prayer_reminders');
    if (!reminders) return false;
    const parsed = JSON.parse(reminders);
    return parsed?.enabled || false;
  } catch {
    return false;
  }
}
