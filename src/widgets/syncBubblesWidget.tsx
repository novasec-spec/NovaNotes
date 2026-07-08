// src/widgets/syncBubblesWidget.ts
"use no memo";
import { requestWidgetUpdate } from 'react-native-android-widget';
import { Platform } from 'react-native';
import { BubblesWidget } from './BubblesWidget';
import { getWidgetData } from './getWidgetData';

/**
 * Pushes fresh data to any "Bubbles" widget(s) currently on the user's home
 * screen. Call this right after you save a note, log a mood, or update the
 * love note — anywhere you currently do AsyncStorage.setItem for those keys.
 *
 * Safe to call on iOS too (no-op there); react-native-android-widget only
 * does anything on Android.
 */
export async function syncBubblesWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getWidgetData();
    await requestWidgetUpdate({
      widgetName: 'Bubbles',
      renderWidget: () => <BubblesWidget {...data} />,
      widgetNotFound: () => {
        // No "Bubbles" widget on the home screen right now — nothing to do.
      },
    });
  } catch (error) {
    console.warn('⚠️ syncBubblesWidget failed:', error);
  }
}
