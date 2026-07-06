// ─────────────────────────────────────────────────────────────────────────────
//  src/app/widgets/widget-task-handler.tsx
// ─────────────────────────────────────────────────────────────────────────────
//
//  Handles all widget lifecycle events from the native Android side.
//  Must be registered via registerWidgetTaskHandler() in index.js BEFORE
//  AppRegistry.registerComponent, so the native bridge has a valid context
//  whenever the Bubbles widget is added, updated, or deleted.
//
//  Fixes: RuntimeException in RNWidgetProvider.onDeleted caused by
//  Objects.requireNonNull receiving a null context/files-dir because no
//  task handler was registered.
//
// ─────────────────────────────────────────────────────────────────────────────

import React from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { BubblesWidget, BubblesWidgetProps } from './BubblesWidget';

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
  { text: "The best is yet to come, and it's coming",  author: '— trust it 💫'      },
  { text: 'You light up every room you walk into',     author: '— it\'s true 💕'    },
  { text: 'Just being you is already everything',      author: '— always 🌸'        },
];

async function loadWidgetData(): Promise<BubblesWidgetProps> {
  const now       = new Date();
  const start     = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
  const quote     = QUOTES[dayOfYear % QUOTES.length];

  let moodEmoji = '😊';
  let moodLabel = 'Feeling good';
  try {
    const moodHistory = await AsyncStorage.getItem('moodHistory');
    if (moodHistory) {
      const moods     = JSON.parse(moodHistory);
      const today     = now.toDateString();
      const todayMood = moods.find(
        (m: any) => new Date(m.timestamp).toDateString() === today
      );
      if (todayMood) {
        moodEmoji = todayMood.emoji ?? moodEmoji;
        moodLabel = todayMood.mood  ?? moodLabel;
      }
    }
  } catch (_) { /* keep defaults */ }

  let streak = 1;
  try {
    const streakRaw = await AsyncStorage.getItem('loginStreak');
    if (streakRaw) {
      const data = JSON.parse(streakRaw);
      streak = data.count ?? 1;
    }
  } catch (_) { /* keep defaults */ }

  let loveNote = 'Something sweet is waiting for you 🌸';
  try {
    const notes = await AsyncStorage.getItem('loveNotes');
    if (notes) {
      const parsed = JSON.parse(notes);
      if (parsed.length > 0) {
        const text = parsed[0].title || parsed[0].text || '';
        loveNote = text.length > 50 ? text.substring(0, 47) + '...' : text;
      }
    }
  } catch (_) { /* keep defaults */ }

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

export async function widgetTaskHandler(props: WidgetTaskHandlerProps): Promise<void> {
  const { widgetAction, widgetName, renderWidget } = props;

  // Only handle our Bubbles widget; ignore anything else.
  if (widgetName !== 'Bubbles') return;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE': {
      try {
        const data = await loadWidgetData();
        renderWidget(<BubblesWidget {...data} />);
      } catch (e) {
        console.error('[WidgetTaskHandler] Failed to render widget:', e);
      }
      break;
    }

    case 'WIDGET_RESIZED':
      // Re-render with existing data on resize.
      try {
        const data = await loadWidgetData();
        renderWidget(<BubblesWidget {...data} />);
      } catch (e) {
        console.error('[WidgetTaskHandler] Failed to render resized widget:', e);
      }
      break;

    case 'WIDGET_DELETED':
      // Nothing to do — the native side handles image cleanup.
      // Having this case registered is what prevents the NPE: it ensures
      // the React Native context is fully initialized before onDeleted fires,
      // so RNWidgetImageProvider.deleteImages receives a valid context.
      break;

    default:
      break;
  }
}