// ─────────────────────────────────────────────────────────────────────────────
//  src/services/widgetSync.ts
// ─────────────────────────────────────────────────────────────────────────────
//
//  Call syncWidget() any time Alice's data changes — after she logs a mood,
//  saves a note, or just whenever the app opens/foregrounds. This pushes
//  fresh data straight to the widget WITHOUT waiting for the 30-min timer.
//
//  This uses requestWidgetUpdate() from react-native-android-widget — it
//  re-runs the same render path as the task handler, just on demand.
//
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import { Platform } from 'react-native';
import { requestWidgetUpdate } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BubblesWidget, BubblesWidgetProps } from '../app/widgets/BubblesWidget';

const QUOTES = [
  { text: 'You are my favourite person in the world',  author: '— always 💕'        },
  { text: 'Every day with you is my favourite day',    author: '— your person 🌸'   },
  { text: 'You make everything more beautiful',        author: '— with love 💕'     },
  { text: 'I choose you. Every single day.',           author: '— yours forever 🥹' },
  { text: 'You are enough, more than enough',          author: '— always here ✨'   },
  { text: 'My heart is yours, Alice',                  author: '— always 💝'        },
  { text: 'Being loved by you is the best thing',      author: '— your person 🌙'   },
  { text: 'You deserve all the good things coming',    author: '— I mean it 💕'     },
  { text: 'You are braver than you believe',           author: '— with love 🌸'     },
  { text: 'The best is yet to come, and it\'s coming', author: '— trust it 💫'      },
  { text: 'You light up every room you walk into',     author: '— it\'s true 💕'    },
  { text: 'Just being you is already everything',      author: '— always 🌸'        },
];

// ─────────────────────────────────────────────────────────────────────────────
//  syncWidget — call from anywhere in your app
// ─────────────────────────────────────────────────────────────────────────────
export async function syncWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await loadWidgetData();

    await requestWidgetUpdate({
      widgetName: 'Bubbles',
      renderWidget: () => <BubblesWidget {...data} />,
      widgetNotFound: () => {
        // Called if Alice hasn't added the widget to her home screen yet.
        // Nothing to do — just means there's no widget to update.
        console.log('[WidgetSync] No Bubbles widget on home screen yet.');
      },
    });

    console.log('[WidgetSync] Widget updated:', data);
  } catch (e) {
    console.error('[WidgetSync] Sync failed:', e);
  }
}

// ── Optional: pass a known mood directly (skip AsyncStorage read) ────────────
export async function syncWidgetMood(emoji: string, label: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const data = await loadWidgetData();
    data.moodEmoji = emoji;
    data.moodLabel = label;

    await requestWidgetUpdate({
      widgetName: 'Bubbles',
      renderWidget: () => <BubblesWidget {...data} />,
      widgetNotFound: () => {},
    });
  } catch (e) {
    console.error('[WidgetSync] Mood sync failed:', e);
  }
}

// ── Optional: pass a fresh note preview directly ──────────────────────────────
export async function syncWidgetLoveNote(noteText: string): Promise<void> {
  if (Platform.OS !== 'android') return;
  try {
    const data = await loadWidgetData();
    data.loveNote = noteText.length > 50 ? noteText.substring(0, 47) + '...' : noteText;

    await requestWidgetUpdate({
      widgetName: 'Bubbles',
      renderWidget: () => <BubblesWidget {...data} />,
      widgetNotFound: () => {},
    });
  } catch (e) {
    console.error('[WidgetSync] Love note sync failed:', e);
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Shared data loader — same logic as widget-task-handler.tsx
// ─────────────────────────────────────────────────────────────────────────────
async function loadWidgetData(): Promise<BubblesWidgetProps> {
  const dayOfYear  = getDayOfYear();
  const quoteIndex = dayOfYear % QUOTES.length;
  const quote      = QUOTES[quoteIndex];

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
        moodEmoji = todayMood.emoji ?? moodEmoji;
        moodLabel = todayMood.mood  ?? moodLabel;
      }
    }
  } catch (e) { /* defaults */ }

  let streak = 1;
  try {
    const streakRaw = await AsyncStorage.getItem('loginStreak');
    if (streakRaw) {
      const data = JSON.parse(streakRaw);
      streak = data.count ?? 1;
    }
  } catch (e) { /* defaults */ }

  let loveNote = 'Something sweet is waiting for you 🌸';
  try {
    const notes = await AsyncStorage.getItem('loveNotes');
    if (notes) {
      const parsed = JSON.parse(notes);
      if (parsed.length > 0) {
        const latest = parsed[0];
        const text   = latest.title || latest.text || '';
        loveNote = text.length > 50 ? text.substring(0, 47) + '...' : text;
      }
    }
  } catch (e) { /* defaults */ }

  const now = new Date();
  const updatedAt = `Updated ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

  return {
    herName: 'Alice',
    quote:       quote.text,
    quoteAuthor: quote.author,
    moodEmoji,
    moodLabel,
    streak,
    loveNote,
    updatedAt,
  };
}

function getDayOfYear(): number {
  const now   = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const diff  = now.getTime() - start.getTime();
  return Math.floor(diff / (1000 * 60 * 60 * 24));
}
