// src/lib/callAvailability.ts
//
// One rule, everywhere: nothing in this codebase checks for LiveKit's
// native module a second way. Every screen/hook imports isCallingAvailable()
// and getVideoView() from here instead of re-detecting Expo Go / requiring
// '@livekit/react-native' directly. That inconsistency is exactly what
// caused this system's worst bugs during development — a static `import`
// of a native module anywhere under src/app/ crashes the ENTIRE app at
// boot (Expo Router eagerly evaluates every file under app/ to build its
// route table), not just the screen that uses it.

import Constants from 'expo-constants';

const isExpoGo = Constants.executionEnvironment === Constants.ExecutionEnvironment?.StoreClient;

let _available: boolean | null = null;
let _VideoView: any = null;

function detect(): boolean {
  if (_available !== null) return _available;

  if (isExpoGo) {
    _available = false;
    return false;
  }

  try {
    // require(), not import — only a function call can be try/caught.
    // A static `import` is hoisted and evaluated before any code runs,
    // so wrapping the *call* to registerGlobals() is not enough; the
    // module load itself must happen inside this try block.
    const RN = require('@livekit/react-native');
    _VideoView = RN.VideoView;
    _available = true;
  } catch (e) {
    console.warn('⚠️ LiveKit native module unavailable:', e);
    _available = false;
  }

  return _available;
}

export function isCallingAvailable(): boolean {
  return detect();
}

/** Returns the native VideoView component, or null if calling isn't available. */
export function getVideoView(): any {
  detect();
  return _VideoView;
}

/**
 * Call ONCE, at the true app entry point (root _layout.tsx), before
 * anything else touches LiveKit. Safe to call even when unavailable.
 */
export function initializeCallingRuntime(): void {
  if (!detect()) return;
  try {
    const { registerGlobals } = require('@livekit/react-native');
    registerGlobals();
  } catch (e) {
    console.warn('⚠️ registerGlobals() failed:', e);
    _available = false;
  }
}
