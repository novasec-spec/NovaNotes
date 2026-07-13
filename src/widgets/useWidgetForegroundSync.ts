// src/widgets/useWidgetForegroundSync.ts
import { useEffect, useRef } from 'react';
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
  const isFirstRun = useRef(true);

  useEffect(() => {
    if (Platform.OS !== 'android') return;

    // Debounce first run
    const initialSync = setTimeout(() => {
      syncBubblesWidget();
    }, 1000);

    const subscription = AppState.addEventListener('change', (state) => {
      if (state === 'active') {
        // Debounce rapid foreground events
        clearTimeout(initialSync);
        setTimeout(() => {
          syncBubblesWidget();
        }, 500);
      }
    });

    return () => {
      clearTimeout(initialSync);
      subscription.remove();
    };
  }, []);
}
