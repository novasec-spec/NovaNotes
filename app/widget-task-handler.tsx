// ─────────────────────────────────────────────────────────────────────────────
//  widget-task-handler.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
//  This runs in a HEADLESS JS context whenever Android needs to update
//  your widget — when it's added, resized, on the periodic update timer,
//  or when YOU call requestWidgetUpdate() from inside the app.
//
//  WIDGET ACTIONS:
//    WIDGET_ADDED   → first time Alice adds the widget to her home screen
//    WIDGET_UPDATE  → periodic refresh (updatePeriodMillis in app.json)
//    WIDGET_RESIZED → she resized it
//    WIDGET_CLICK   → she tapped it
//    WIDGET_DELETED → she removed it
//
//  Place this file at the project root (same level as App.tsx / app.json).
//
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { BubblesWidget, BubblesWidgetProps } from './widgets/BubblesWidget';

// ── Map widget "name" (from app.json plugin config) → component ─────────────
const nameToWidget = {
  Bubbles: BubblesWidget,
};

// ── Daily rotating quotes — same set used by widgetService ───────────────────
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
//  Main task handler — exported and registered in index.js
// ─────────────────────────────────────────────────────────────────────────────
export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const widgetInfo = props.widgetInfo;
  const Widget = nameToWidget[widgetInfo.widgetName as keyof typeof nameToWidget];

  if (!Widget) {
    console.warn(`[WidgetTaskHandler] Unknown widget: ${widgetInfo.widgetName}`);
    return;
  }

  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const data = await loadWidgetData();
      props.renderWidget(<Widget {...data} />);
      break;
    }

    case 'WIDGET_DELETED':
      // Nothing to clean up — data lives in AsyncStorage, not per-widget
      break;

    case 'WIDGET_CLICK': {
      // clickAction="OPEN_APP" on the FlexWidget already opens the app
      // automatically. If you add buttons with custom clickActions later
      // (e.g. "MARK_DONE"), handle them here:
      //
      // if (props.clickActionData?.action === 'MARK_DONE') { ... }
      break;
    }

    default:
      break;
  }
}

// ─────────────────────────────────────────────────────────────────────────────
//  Load all widget data from AsyncStorage — same sources as your app screens
// ─────────────────────────────────────────────────────────────────────────────
async function loadWidgetData(): Promise<BubblesWidgetProps> {
  // ── 1. Today's rotating quote ─────────────────────────────────────────────
  const dayOfYear  = getDayOfYear();
  const quoteIndex = dayOfYear % QUOTES.length;
  const quote      = QUOTES[quoteIndex];

  // ── 2. Today's mood (written by MoodTracker / HomeScreen) ────────────────
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
  } catch (e) {
    console.warn('[WidgetTaskHandler] mood load failed:', e);
  }

  // ── 3. Login streak ────────────────────────────────────────────────────────
  let streak = 1;
  try {
    const streakRaw = await AsyncStorage.getItem('loginStreak');
    if (streakRaw) {
      const data = JSON.parse(streakRaw);
      streak = data.count ?? 1;
    }
  } catch (e) {
    console.warn('[WidgetTaskHandler] streak load failed:', e);
  }

  // ── 4. Latest love note preview ───────────────────────────────────────────
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
  } catch (e) {
    console.warn('[WidgetTaskHandler] notes load failed:', e);
  }

  // ── 5. Formatted update time ──────────────────────────────────────────────
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
