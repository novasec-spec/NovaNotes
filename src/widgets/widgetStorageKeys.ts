// src/widgets/widgetStorageKeys.ts
//
// ⚠️ Central storage keys for all widget data
// Make sure these match your app's actual storage keys

export const STORAGE_KEYS = {
  // Notes
  NOTES: 'notes_data',
  
  // Mood History
  MOODS: 'moodHistory',
  
  // Streak (computed or stored)
  STREAK_OVERRIDE: 'loginStreak',
  
  // Love Note / From Him
  LOVE_NOTE: 'love_note',
  
  // User Name
  USER_NAME: 'chat_user',
  
  // Last Backup Time
  LAST_BACKUP: 'notes_last_backup_at',
  
  // Today's Date (to check if data is fresh)
  LAST_WIDGET_UPDATE: 'last_widget_update',
  
  // Unread Messages Count
  UNREAD_MESSAGES: 'unread_messages',
  
  // Tasks Count
  TASKS: 'tasks_data',
};

export const MOOD_EMOJI: Record<string, string> = {
  happy: '😊',
  loved: '🥰',
  relaxed: '😌',
  thoughtful: '🤔',
  sad: '😢',
  frustrated: '😤',
  anxious: '😰',
  grateful: '🙏',
  dreamy: '🌙',
  energetic: '⚡',
  tired: '😴',
  motivated: '💪',
  lazy: '🛋️',
  focused: '🎯',
  restless: '🌊',
  calm: '🧘',
  stressed: '😫',
  refreshed: '🌿',
  sick: '🤒',
  strong: '🦁',
  nourished: '🍎',
  social: '👥',
  lonely: '🥺',
  missing: '💔',
  connected: '🤝',
  playful: '🎉',
  romantic: '💕',
  blessed: '✨',
  prayerful: '🙏',
  hopeful: '🌈',
  peaceful: '🕊️',
  curious: '🔍',
};

export const MOOD_COLORS: Record<string, string> = {
  happy: '#F59E0B',
  loved: '#FF6B9D',
  relaxed: '#22C55E',
  thoughtful: '#A855F7',
  sad: '#60A5FA',
  frustrated: '#F97316',
  anxious: '#8B5CF6',
  grateful: '#14B8A6',
  dreamy: '#A78BFA',
  energetic: '#F97316',
  tired: '#94A3B8',
  motivated: '#3B82F6',
  lazy: '#D97706',
  focused: '#0EA5E9',
  restless: '#EC4899',
  calm: '#10B981',
  stressed: '#F43F5E',
  refreshed: '#06B6D4',
  sick: '#FB923C',
  strong: '#7C3AED',
  nourished: '#84CC16',
  social: '#F472B6',
  lonely: '#64748B',
  missing: '#E879F9',
  connected: '#2DD4BF',
  playful: '#FBBF24',
  romantic: '#F43F5E',
  blessed: '#A855F7',
  prayerful: '#8B5CF6',
  hopeful: '#FCD34D',
  peaceful: '#34D399',
  curious: '#38BDF8',
};
