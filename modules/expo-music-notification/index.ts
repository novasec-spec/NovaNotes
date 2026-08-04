import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type {
  MusicNotificationTrack,
  MusicNotificationEventName,
  MusicNotificationSeekPayload,
  MusicNotificationSubscription,
} from './src/types';

export type { MusicNotificationTrack, MusicNotificationSeekPayload };

// Guarded lookup, same pattern used elsewhere in this app (widget / Quick
// Settings Tile): if the native module isn't linked yet (e.g. running in
// Expo Go, mid-prebuild, or on iOS) every call below becomes a safe no-op
// instead of crashing the app at boot.
const { MusicNotification: NativeMusicNotification } = NativeModules;

const isAvailable = Platform.OS === 'android' && !!NativeMusicNotification;

const emitter = isAvailable ? new NativeEventEmitter(NativeMusicNotification) : null;

function addListener(
  event: MusicNotificationEventName,
  handler: (payload?: any) => void
): MusicNotificationSubscription {
  if (!emitter) return { remove: () => {} };
  const sub = emitter.addListener(event, handler);
  return { remove: () => sub.remove() };
}

async function showNotification(track: MusicNotificationTrack, isPlaying: boolean): Promise<void> {
  if (!isAvailable) return;
  try {
    await NativeMusicNotification.showNotification(track, isPlaying);
  } catch (e) {
    console.warn('[MusicNotification] showNotification failed', e);
  }
}

function updateTrack(track: MusicNotificationTrack, isPlaying: boolean): void {
  if (!isAvailable) return;
  NativeMusicNotification.updateTrack(track, isPlaying);
}

function updatePlaybackState(isPlaying: boolean, positionSeconds: number, durationSeconds: number): void {
  if (!isAvailable) return;
  NativeMusicNotification.updatePlaybackState(isPlaying, positionSeconds, durationSeconds);
}

function hideNotification(): void {
  if (!isAvailable) return;
  NativeMusicNotification.hideNotification();
}

const MusicNotificationBridge = {
  isAvailable,
  showNotification,
  updateTrack,
  updatePlaybackState,
  hideNotification,
  onPlay: (cb: () => void) => addListener('MusicNotification:onPlay', cb),
  onPause: (cb: () => void) => addListener('MusicNotification:onPause', cb),
  onNext: (cb: () => void) => addListener('MusicNotification:onNext', cb),
  onPrevious: (cb: () => void) => addListener('MusicNotification:onPrevious', cb),
  onSeek: (cb: (payload: MusicNotificationSeekPayload) => void) =>
    addListener('MusicNotification:onSeek', cb),
  onStop: (cb: () => void) => addListener('MusicNotification:onStop', cb),
};

export default MusicNotificationBridge;
