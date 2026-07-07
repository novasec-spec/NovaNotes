// src/widgets/widgetStorageKeys.ts
//
// ⚠️ EDIT THESE to match whatever keys your app already uses for notes,
// moods, and streak. I don't have your actual storage schema, so these are
// reasonable guesses — the important thing is BOTH your app code and the
// widget code point at the same keys.

export const STORAGE_KEYS = {
  // Expected shape: JSON array of { id: string; text: string; createdAt: string (ISO) }
  NOTES: 'notes_data',

  // Expected shape: JSON array of { date: string (YYYY-MM-DD); mood: string }
  // `mood` should be one of the keys in MOOD_EMOJI below (or extend it).
  MOODS: 'moodHistory',

  // Optional: if you already track streak separately, point this at it.
  // If not set / not found, streak is computed from NOTES + MOODS dates.
  STREAK_OVERRIDE: 'login-streak',

  // Optional: today's "love note" if your app lets users set/save one.
  // If not found, the widget just won't show a love-note line.
  LOVE_NOTE: 'notes_data',
};

export const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  calm: '😌',
  sad: '😔',
  anxious: '😟',
  excited: '🤩',
  tired: '😴',
  angry: '😠',
  neutral: '🙂',
};
