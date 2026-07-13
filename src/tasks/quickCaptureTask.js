// src/tasks/quickCaptureTask.js
//
// Registered as a Headless JS task (see index.js). Runs when the Quick
// Settings tile is tapped — no screen, no Activity. Must be fast and
// resilient: this can run with the app fully "cold" (process not
// previously alive), so don't assume any in-memory app state exists.
import { NativeModules } from 'react-native';
import * as Clipboard from 'expo-clipboard';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase'; // adjust path to your project

const { QuickCaptureModule } = NativeModules;

export default async function quickCaptureTask() {
  let clipboardContent = '';

  try {
    clipboardContent = (await Clipboard.getStringAsync()) || '';
  } catch {
    // Android 10+ restricts clipboard reads from apps that aren't the
    // current input method / focused window. A background service
    // triggered from Quick Settings does not reliably count as focused on
    // every OEM build, so this can silently fail — that's expected, not a
    // bug. We fall back to a blank timestamped note below.
  }

  const note = {
    title: `Quick note — ${new Date().toLocaleString()}`,
    content: clipboardContent,
    created_via: 'quick_tile',
    created_at: new Date().toISOString(),
  };

  const localKey = `pending_note:${Date.now()}`;

  try {
    // Write locally first — capture should never silently fail just
    // because the device is offline at the moment of the tap.
    await AsyncStorage.setItem(localKey, JSON.stringify(note));

    // Best-effort remote sync. Don't await this before reporting success —
    // headless tasks are expected to finish quickly, and the local write
    // already guarantees the note isn't lost.
    supabase
      .from('notes')
      .insert(note)
      .then(({ error }) => {
        if (!error) AsyncStorage.removeItem(localKey);
      });

    QuickCaptureModule?.finish(
      true,
      clipboardContent ? 'Note saved from clipboard' : 'Note saved'
    );
  } catch (err) {
    console.error('quickCaptureTask failed:', err);
    QuickCaptureModule?.finish(false, 'Could not save note — open the app to retry');
  }
}
