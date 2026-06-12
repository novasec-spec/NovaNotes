// ─────────────────────────────────────────────────────────────────────────────
//  src/services/widgetService.ts
//  Writes widget data to SharedPreferences via fumedeme-expo-widget
//  The Android widget (BubblesWidgetProvider.kt) reads these same keys
// ─────────────────────────────────────────────────────────────────────────────

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform }  from 'react-native';

// ── Import fumedeme-expo-widget ───────────────────────────────────────────────
// This module bridges RN ↔ SharedPreferences ↔ Android widget
let FumeWidget: any = null;
try {
  FumeWidget = require('fumedeme-expo-widget');
} catch (e) {
  console.warn('[WidgetService] fumedeme-expo-widget not available:', e);
}

// ── SharedPreferences name — must match BubblesWidgetProvider.kt ─────────────
const PREFS_NAME = 'BubblesWidgetPrefs';

// ── Data keys — must match Kotlin companion object constants ─────────────────
const KEYS = {
  QUOTE:       'widget_quote',
  QUOTE_AUTHOR:'widget_quote_author',
  MOOD:        'widget_mood',
  MOOD_LABEL:  'widget_mood_label',
  STREAK:      'widget_streak',
  LOVE_NOTE:   'widget_love_note',
  UPDATED_AT:  'widget_updated_at',
  HER_NAME:    'widget_her_name',
};

// ── Daily rotating quotes ─────────────────────────────────────────────────────
const QUOTES = [
  { text: 'You are my favourite person in the world',    author: '— always 💕'        },
  { text: 'Every day with you is my favourite day',      author: '— your person 🌸'   },
  { text: 'You make everything more beautiful',          author: '— with love 💕'     },
  { text: 'I choose you. Every single day.',             author: '— yours forever 🥹' },
  { text: 'You are enough, more than enough',            author: '— always here ✨'   },
  { text: 'My heart is yours, Alice',                    author: '— always 💝'        },
  { text: 'Being loved by you is the best thing',        author: '— your person 🌙'   },
  { text: 'You deserve all the good things coming',      author: '— I mean it 💕'     },
  { text: 'You are braver than you believe',             author: '— with love 🌸'     },
  { text: 'The best is yet to come, and it\'s coming',   author: '— trust it 💫'      },
  { text: 'You light up every room you walk into',       author: '— it\'s true 💕'    },
  { text: 'Just being you is already everything',        author: '— always 🌸'        },
];

// ── Mood icon → label map ─────────────────────────────────────────────────────
const MOOD_LABELS: Record<string, string> = {
  'happy-outline':        'Happy',
  'heart-outline':        'Feeling soft',
  'moon-outline':         'Dreamy',
  'sunny-outline':        'Grateful',
  'bulb-outline':         'Thinking',
  'flame-outline':        'Chaotic',
  'rainy-outline':        'A little sad',
  'thunderstorm-outline': 'Frustrated',
  'rose-outline':         'In love',
  'leaf-outline':         'Chill',
};

// ── Mood index → emoji map ────────────────────────────────────────────────────
const MOOD_EMOJIS = ['😊','💗','🌙','☀️','💭','🔥','🌧️','⛈️','🌹','🍃'];

// ─────────────────────────────────────────────────────────────────────────────
//  Core function — write all widget data then trigger a refresh
// ─────────────────────────────────────────────────────────────────────────────
export async function syncWidgetData(): Promise<void> {
  if (Platform.OS !== 'android') return;
  if (!FumeWidget) {
    console.warn('[WidgetService] fumedeme-expo-widget not loaded');
    return;
  }

  try {
    // ── 1. Get today's quote (rotates by day of year) ─────────────────────
    const dayOfYear  = getDayOfYear();
    const quoteIndex = dayOfYear % QUOTES.length;
    const quote      = QUOTES[quoteIndex];

    // ── 2. Load mood from AsyncStorage (set by MoodTracker) ───────────────
    let moodEmoji = '😊';
    let moodLabel = 'Feeling good';
    try {
      const moodHistory = await AsyncStorage.getItem('moodHistory');
      if (moodHistory) {
        const moods     = JSON.parse(moodHistory);
        const today     = new Date().toDateString();
        const todayMood = moods.find(
          (m: any) => new Date(m.timestamp).toDateString() === today
        );
        if (todayMood) {
          moodEmoji = todayMood.emoji  ?? MOOD_EMOJIS[todayMood.moodIndex ?? 0];
          moodLabel = todayMood.mood   ?? MOOD_LABELS[todayMood.icon ?? ''] ?? 'Feeling good';
        }
      }
    } catch (e) { /* use defaults */ }

    // ── 3. Load streak ─────────────────────────────────────────────────────
    let streak = 1;
    try {
      const streakRaw = await AsyncStorage.getItem('loginStreak');
      if (streakRaw) {
        const data = JSON.parse(streakRaw);
        streak = data.count ?? 1;
      }
    } catch (e) { /* use default */ }

    // ── 4. Load latest love note preview ──────────────────────────────────
    let loveNotePreview = 'Something sweet is waiting for you 🌸';
    try {
      const notes = await AsyncStorage.getItem('loveNotes');
      if (notes) {
        const parsed = JSON.parse(notes);
        if (parsed.length > 0) {
          const latest = parsed[0];
          const text   = latest.title || latest.text || '';
          loveNotePreview = text.length > 50
            ? text.substring(0, 47) + '...'
            : text;
        }
      }
    } catch (e) { /* use default */ }

    // ── 5. Write all keys to SharedPreferences via fumedeme-expo-widget ───
    const now = new Date().toISOString().substring(0, 19); // no milliseconds

    const widgetData = {
      [KEYS.QUOTE]:        quote.text,
      [KEYS.QUOTE_AUTHOR]: quote.author,
      [KEYS.MOOD]:         moodEmoji,
      [KEYS.MOOD_LABEL]:   moodLabel,
      [KEYS.STREAK]:       streak,
      [KEYS.LOVE_NOTE]:    loveNotePreview,
      [KEYS.UPDATED_AT]:   now,
      [KEYS.HER_NAME]:     'Alice',
    };

    // fumedeme-expo-widget API — setWidgetData(prefsName, data)
    // This writes to SharedPreferences which the Kotlin widget reads
    if (typeof FumeWidget.setWidgetData === 'function') {
      await FumeWidget.setWidgetData(PREFS_NAME, widgetData);
    } else if (typeof FumeWidget.default?.setWidgetData === 'function') {
      await FumeWidget.default.setWidgetData(PREFS_NAME, widgetData);
    } else {
      // Fallback: try direct key writes
      for (const [key, value] of Object.entries(widgetData)) {
        await FumeWidget.setItem?.(key, String(value), PREFS_NAME);
      }
    }

    // ── 6. Trigger widget refresh ──────────────────────────────────────────
    if (typeof FumeWidget.reloadWidget === 'function') {
      await FumeWidget.reloadWidget();
    } else if (typeof FumeWidget.updateWidget === 'function') {
      await FumeWidget.updateWidget('BubblesWidgetProvider');
    } else if (typeof FumeWidget.default?.reloadWidget === 'function') {
      await FumeWidget.default.reloadWidget();
    }

    console.log('[WidgetService] Widget synced successfully:', { quoteIndex, moodEmoji, streak });

  } catch (err) {
    console.error('[WidgetService] Sync failed:', err);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Update widget with a specific love note (call from NotesScreen after save)
// ─────────────────────────────────────────────────────────────────────────────
export async function updateWidgetLoveNote(noteText: string): Promise<void> {
  if (Platform.OS !== 'android' || !FumeWidget) return;
  try {
    const preview = noteText.length > 50
      ? noteText.substring(0, 47) + '...'
      : noteText;

    await FumeWidget.setWidgetData?.(PREFS_NAME, {
      [KEYS.LOVE_NOTE]:  preview,
      [KEYS.UPDATED_AT]: new Date().toISOString().substring(0, 19),
    });
    await FumeWidget.reloadWidget?.();
  } catch (e) {
    console.error('[WidgetService] updateWidgetLoveNote failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Update widget mood immediately after Alice logs her mood
// ─────────────────────────────────────────────────────────────────────────────
export async function updateWidgetMood(
  emoji: string,
  label: string
): Promise<void> {
  if (Platform.OS !== 'android' || !FumeWidget) return;
  try {
    await FumeWidget.setWidgetData?.(PREFS_NAME, {
      [KEYS.MOOD]:       emoji,
      [KEYS.MOOD_LABEL]: label,
      [KEYS.UPDATED_AT]: new Date().toISOString().substring(0, 19),
    });
    await FumeWidget.reloadWidget?.();
  } catch (e) {
    console.error('[WidgetService] updateWidgetMood failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Helpers
// ─────────────────────────────────────────────────────────────────────────────
function getDayOfYear(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff  = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
