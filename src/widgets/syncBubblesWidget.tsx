// src/widgets/syncBubblesWidget.ts
"use no memo";
import { requestWidgetUpdate } from 'react-native-android-widget';
import { Platform } from 'react-native';
import { BubblesWidget } from './BubblesWidget';
import { getWidgetData } from './getWidgetData';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { STORAGE_KEYS } from './widgetStorageKeys';

export async function syncBubblesWidget(): Promise<void> {
  if (Platform.OS !== 'android') return;

  try {
    const data = await getWidgetData();
    
    // Update last widget update timestamp
    await AsyncStorage.setItem(STORAGE_KEYS.LAST_WIDGET_UPDATE, String(Date.now()));
    
    await requestWidgetUpdate({
      widgetName: 'Bubbles',
      renderWidget: () => <BubblesWidget {...data} />,
      widgetNotFound: () => {
        // No widget on home screen
      },
    });
  } catch (error) {
    console.warn('⚠️ syncBubblesWidget failed:', error);
  }
}

// ─── Trigger sync from various app events ──────────────────────────────

export const triggerWidgetSync = {
  onNoteSaved: async () => {
    await syncBubblesWidget();
  },
  onMoodLogged: async () => {
    await syncBubblesWidget();
  },
  onNewMessage: async () => {
    await syncBubblesWidget();
  },
  onTaskChanged: async () => {
    await syncBubblesWidget();
  },
  onLoveNoteUpdated: async () => {
    await syncBubblesWidget();
  },
  onAppForeground: async () => {
    await syncBubblesWidget();
  },
};
