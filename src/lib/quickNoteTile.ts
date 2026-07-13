// src/lib/quickNoteTile.ts
import { Platform } from 'react-native';
import { useEffect } from 'react';
import { router } from 'expo-router';

const TILE_LABEL = 'Quick Note'; // must exactly match the manifest string value set by the config plugin
const TILE_ICON = 'ic_quick_note'; // must match the drawable filename the config plugin writes

let _module: any = null;
let _checked = false;

function getModule(): any {
  if (Platform.OS !== 'android') return null;
  if (_checked) return _module;
  _checked = true;
  try {
    // require(), not static import — same reasoning as LiveKit: this native
    // module doesn't exist in Expo Go, and a static import at the top of a
    // file under src/app/ would crash the whole app at boot.
    _module = require('react-native-android-quick-settings-tiles').default;
  } catch (e) {
    console.warn('⚠️ Quick Settings Tile native module unavailable:', e);
    _module = null;
  }
  return _module;
}

export type RequestTileResult = 'granted' | 'unavailable' | 'error';

/**
 * Prompts the Android "Add tile to Quick Settings" system dialog.
 * Only works on Android 13+; returns 'unavailable' on older versions or
 * when the native module isn't present (Expo Go / not yet rebuilt).
 */
export async function requestAddQuickNoteTile(): Promise<RequestTileResult> {
  const RNQuickSettings = getModule();
  if (!RNQuickSettings) return 'unavailable';

  try {
    const result = await RNQuickSettings.request({
      isDialog: false,
      quickLabel: TILE_LABEL,
      icon: TILE_ICON,
    });
    return result?.type === 'GRANTED' ? 'granted' : 'unavailable';
  } catch (e) {
    console.warn('⚠️ requestAddQuickNoteTile failed:', e);
    return 'error';
  }
}

/**
 * Call once near the root of the app. Handles both cases:
 * - App was cold-started BY tapping the tile (getLastChanged)
 * - App was already running when the tile was tapped (addEventListener)
 */
export function useQuickNoteTileListener(routePath: string = '/new-note') {
  useEffect(() => {
    const RNQuickSettings = getModule();
    if (!RNQuickSettings) return;

    let cancelled = false;

    RNQuickSettings.getLastChanged?.().then((data: any) => {
      if (!cancelled && data) router.push(routePath as any);
    });

    const subscription = RNQuickSettings.addEventListener?.('onChange', () => {
      router.push(routePath as any);
    });

    return () => {
      cancelled = true;
      // This package's addEventListener return type isn't consistently
      // documented — guard both a subscription object and a plain no-op.
      subscription?.remove?.();
    };
  }, [routePath]);
}
