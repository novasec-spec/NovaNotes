// src/widgets/useWidgetForegroundSync.ts
import { useEffect } from 'react';
import { AppState, Platform } from 'react-native';
import { syncBubblesWidget } from './syncBubblesWidget';

/**
 * Call this once from your root layout (e.g. src/app/_layout.tsx):
 *
 *   useWidgetForegroundSync();
 *
 * Pushes a widget refresh whenever the app becomes active — cheap insurance
 * on top of the explicit syncBubblesWidget() calls after saves, and the
 * 30-min updatePeriodMillis in app.json.
 */
export function useWidgetForegroundSync() {
  useEffect(() => {
    if (Platform.OS !== 'android') return;

    syncBubblesWidget(); // once on mount

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') syncBubblesWidget();
    });

    return () => subscription.remove();
  }, []);
}
