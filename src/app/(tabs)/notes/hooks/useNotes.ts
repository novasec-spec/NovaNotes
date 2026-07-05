// hooks/useNotes.ts
import { useState, useCallback, useEffect } from 'react';
import { Alert, AppState, AppStateStatus } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Note, NoteStats, StreakData, Folder } from '../types';
import { 
  generateId, 
  calculateStats, 
  calculateStreak, 
  getCurrentLocation, 
  getWeather, 
  migrateNotes,
  wordCount
} from '../utils/helpers';
import { STORAGE_KEYS, AUTO_SAVE_INTERVAL } from '../utils/constants';
import { syncManager } from '../services/syncManager';
import { saveNotesLocally, loadNotesLocally } from '../services/storage';
import * as Notifications from 'expo-notifications';
import { useAuth } from '../../../../contexts/AuthContext';
import { useNotification } from '../../../../contexts/NotificationContext';
import { NoteReminder, ReminderStats } from '../types';

export function useNotes() {
  const { user } = useAuth(); // Get user from auth
  const userEmail = user?.email || null;
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<NoteStats | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const { sendNotification, sendScheduled } = useNotification();
  const [reminders, setReminders] = useState<NoteReminder[]>([]);
  const [reminderStats, setReminderStats] = useState<ReminderStats | null>(null);

  useEffect(() => {
    syncManager.setUserEmail(userEmail);
  }, [userEmail]);


// hooks/useNotes.ts - Complete loadNotes function
  const setNoteReminder = useCallback(async (
    noteId: string,
    minutes: number | null,
    recurring?: {
      frequency: 'daily' | 'weekly' | 'monthly';
      time: string;
      daysOfWeek?: number[];
      dayOfMonth?: number;
    }
  ) => {
    const note = notes.find(n => n.id === noteId);
    if (!note) {
      console.error('❌ Note not found');
      return null;
    }

    // If minutes is null, remove reminder
    if (minutes === null) {
      const updated = notes.map(n => {
        if (n.id === noteId) {
          const { reminder, reminderId, ...rest } = n;
          return { ...rest, reminderScheduled: false };
        }
        return n;
      });
      await saveNotesLocally(updated);
      setNotes(updated);
      return null;
    }

    // Calculate scheduled time
    const scheduledTime = new Date();
    scheduledTime.setMinutes(scheduledTime.getMinutes() + minutes);

    const reminder: NoteReminder = {
      id: `reminder_${Date.now()}_${Math.random().toString(36).substring(7)}`,
      noteId: note.id,
      scheduledFor: scheduledTime,
      type: recurring ? 'recurring' : 'single',
      recurringPattern: recurring?.frequency,
      daysOfWeek: recurring?.daysOfWeek,
      dayOfMonth: recurring?.dayOfMonth,
      message: `Reminder: ${note.title || 'Note'}`,
      enabled: true,
    };

    // Send scheduled notification
    try {
      const notification = await sendScheduled?.({
        userId: user?.id || '',
        title: `📝 Note Reminder: ${note.title || 'Untitled'}`,
        body: note.text?.substring(0, 100) || 'You have a note reminder',
        type: 'reminder',
        data: {
          screen: 'notes',
          params: { noteId: note.id },
          noteId: note.id,
          reminderId: reminder.id,
          isNoteReminder: true,
        },
        scheduledFor: scheduledTime,
        priority: 'high',
        categoryId: 'reminder',
      });

      if (notification) {
        // Update note with reminder
        const updated = notes.map(n => {
          if (n.id === noteId) {
            return {
              ...n,
              reminder,
              reminderId: reminder.id,
              reminderScheduled: true,
              _synced: false,
            };
          }
          return n;
        });

        await saveNotesLocally(updated);
        setNotes(updated);
        setDirty(true);

        // Track reminder stats
        await updateReminderStats();

        console.log(`✅ Reminder set for note: ${note.id} at ${scheduledTime.toLocaleString()}`);
        return reminder;
      }
    } catch (error) {
      console.error('❌ Error setting reminder:', error);
    }

    return null;
  }, [notes, user?.id, sendScheduled]);

  // ─── UPDATE REMINDER STATS ───────────────────────────

  const updateReminderStats = useCallback(async () => {
    const activeReminders = notes.filter(n => n.reminder?.enabled);
    const now = new Date();

    const upcoming = activeReminders.filter(r =>
      new Date(r.reminder!.scheduledFor) > now
    );
    const overdue = activeReminders.filter(r =>
      new Date(r.reminder!.scheduledFor) < now
    );

    setReminderStats({
      total: notes.filter(n => n.reminder).length,
      active: activeReminders.length,
      completed: notes.filter(n => n.reminder && !n.reminder.enabled).length,
      upcoming: upcoming.length,
      overdue: overdue.length,
    });

    // Save stats
    await AsyncStorage.setItem('reminder_stats', JSON.stringify(reminderStats));
  }, [notes]);

  // ─── CHECK UPCOMING REMINDERS ────────────────────────

  const checkUpcomingReminders = useCallback(async () => {
    const now = new Date();
    const nextHour = new Date(now.getTime() + 60 * 60 * 1000);

    const upcomingReminders = notes.filter(n =>
      n.reminder?.enabled &&
      new Date(n.reminder.scheduledFor) >= now &&
      new Date(n.reminder.scheduledFor) <= nextHour
    );

    for (const note of upcomingReminders) {
      await sendNotification({
        userId: user?.id || '',
        title: `⏰ ${note.reminder?.message || 'Note Reminder'}`,
        body: note.text?.substring(0, 100) || 'You have a reminder',
        type: 'reminder',
        data: {
          screen: 'notes',
          params: { noteId: note.id },
          noteId: note.id,
          isNoteReminder: true,
        },
        showLocal: true,
        priority: 'high',
        categoryId: 'reminder',
      });

      // Update reminder last triggered
      const updated = notes.map(n => {
        if (n.id === note.id && n.reminder) {
          return {
            ...n,
            reminder: {
              ...n.reminder,
              lastTriggered: now.toISOString(),
            },
          };
        }
        return n;
      });
      await saveNotesLocally(updated);
      setNotes(updated);
    }

    // Update stats
    await updateReminderStats();
  }, [notes, user?.id, sendNotification]);

  // ─── PROCESS RECURRING REMINDERS ─────────────────────

  const processRecurringReminders = useCallback(async () => {
    const now = new Date();
    const today = now.toDateString();

    const recurringNotes = notes.filter(n =>
      n.reminder?.type === 'recurring' &&
      n.reminder?.enabled &&
      (!n.reminder.lastTriggered || new Date(n.reminder.lastTriggered).toDateString() !== today)
    );

    for (const note of recurringNotes) {
      const reminder = note.reminder!;
      let shouldTrigger = false;

      switch (reminder.recurringPattern) {
        case 'daily':
          shouldTrigger = true;
          break;
        case 'weekly':
          if (reminder.daysOfWeek?.includes(now.getDay())) {
            shouldTrigger = true;
          }
          break;
        case 'monthly':
          if (reminder.dayOfMonth === now.getDate()) {
            shouldTrigger = true;
          }
          break;
      }

      if (shouldTrigger) {
        // Send notification
        await sendNotification({
          userId: user?.id || '',
          title: `🔄 ${note.title || 'Note Reminder'}`,
          body: note.text?.substring(0, 100) || 'Recurring reminder',
          type: 'reminder',
          data: {
            screen: 'notes',
            params: { noteId: note.id },
            noteId: note.id,
            isNoteReminder: true,
          },
          showLocal: true,
          priority: 'high',
          categoryId: 'reminder',
        });

        // Update last triggered
        const updated = notes.map(n => {
          if (n.id === note.id && n.reminder) {
            return {
              ...n,
              reminder: {
                ...n.reminder,
                lastTriggered: now.toISOString(),
                scheduledFor: new Date(now.getTime() + 24 * 60 * 60 * 1000),
              },
            };
          }
          return n;
        });
        await saveNotesLocally(updated);
        setNotes(updated);
      }
    }
  }, [notes, user?.id, sendNotification]);

  // ─── COMPLETE REMINDER ───────────────────────────────

  const completeReminder = useCallback(async (noteId: string) => {
    const updated = notes.map(n => {
      if (n.id === noteId && n.reminder) {
        return {
          ...n,
          reminder: {
            ...n.reminder,
            enabled: false,
          },
        };
      }
      return n;
    });
    await saveNotesLocally(updated);
    setNotes(updated);
    await updateReminderStats();
  }, [notes]);

  // ─── SNOOZE REMINDER ─────────────────────────────────

  const snoozeReminder = useCallback(async (noteId: string, minutes: number = 30) => {
    const updated = notes.map(n => {
      if (n.id === noteId && n.reminder) {
        const newTime = new Date();
        newTime.setMinutes(newTime.getMinutes() + minutes);
        return {
          ...n,
          reminder: {
            ...n.reminder,
            scheduledFor: newTime,
          },
        };
      }
      return n;
    });
    await saveNotesLocally(updated);
    setNotes(updated);
    await updateReminderStats();

    // Reschedule notification
    // ... implementation
  }, [notes]);

  // ─── GET REMINDER STATS ──────────────────────────────

  const getReminderStats = useCallback((): ReminderStats => {
    const allReminders = notes.filter(n => n.reminder);
    const active = allReminders.filter(n => n.reminder?.enabled);
    const now = new Date();

    return {
      total: allReminders.length,
      active: active.length,
      completed: allReminders.filter(n => !n.reminder?.enabled).length,
      upcoming: active.filter(n => new Date(n.reminder!.scheduledFor) > now).length,
      overdue: active.filter(n => new Date(n.reminder!.scheduledFor) < now).length,
    };
  }, [notes]);

useEffect(() => {
    if (notes.length > 0) {
      updateReminderStats();

      // Check reminders every 5 minutes
      const interval = setInterval(() => {
        checkUpcomingReminders();
        processRecurringReminders();
      }, 5 * 60 * 1000);

      return () => clearInterval(interval);
    }
  }, [notes]);

const loadNotes = useCallback(async () => {
  try {
    setLoading(true);
    console.log('📂 Loading notes...');
    
    if (!userEmail) {
      console.log('⚠️ No user logged in');
      setLoading(false);
      return;
    }
    
    // STEP 1: ALWAYS load from local storage FIRST (offline-first)
    console.log('📂 Loading from local storage...');
    const localNotes = await loadNotesLocally();
    
    if (localNotes.length > 0) {
      console.log(`✅ Loaded ${localNotes.length} notes from local storage`);
      setNotes(localNotes);
      setLoading(false);
      
      // STEP 2: Try to sync with cloud in BACKGROUND (don't block UI)
      setTimeout(async () => {
        try {
          const online = await syncManager.isOnline();
          if (online) {
            console.log('☁️ Online - syncing with cloud...');
            await syncManager.run(localNotes, (synced) => {
              setNotes(synced);
              saveNotesLocally(synced);
            });
          } else {
            console.log('📡 Offline - using local notes only');
          }
        } catch (error) {
          console.error('Background sync error:', error);
        }
      }, 500);
      
      return;
    }
    
    // STEP 3: No local notes - try cloud restore
    console.log('📭 No local notes, checking cloud...');
    const online = await syncManager.isOnline();
    
    if (online) {
      console.log('☁️ Online - restoring from cloud...');
      const restored = await syncManager.restoreFromCloud();
      if (restored.length > 0) {
        console.log(`✅ Restored ${restored.length} notes from cloud`);
        await saveNotesLocally(restored);
        setNotes(restored);
        setLoading(false);
        return;
      }
    } else {
      console.log('📡 Offline - no local notes available');
    }
    
    console.log('📭 No notes found anywhere');
    setNotes([]);
    setLoading(false);
    
  } catch (error) {
    console.error('❌ Load error:', error);
    // Always try to load from local even on error
    try {
      const localNotes = await loadNotesLocally();
      if (localNotes.length > 0) {
        console.log(`✅ Fallback: Loaded ${localNotes.length} local notes`);
        setNotes(localNotes);
      }
    } catch (e) {
      console.error('Fallback error:', e);
      setNotes([]);
    }
    setLoading(false);
  }
}, [userEmail]);

// Add merge function
const mergeNotes = (local: Note[], cloud: Note[]): Note[] => {
  const noteMap = new Map<string, Note>();

  // Add cloud notes first (they have _synced = true)
  cloud.forEach(note => noteMap.set(note.id, note));

  // Add local notes (they might have newer changes)
  local.forEach(note => {
    if (noteMap.has(note.id)) {
      // If both exist, keep the one with newer updatedAt
      const existing = noteMap.get(note.id)!;
      if (new Date(note.updatedAt) > new Date(existing.updatedAt)) {
        noteMap.set(note.id, { ...note, _synced: false }); // Mark as needing sync
      }
    } else {
      noteMap.set(note.id, note);
    }
  });

  return Array.from(noteMap.values());
};

  useEffect(() => {
    console.log('🔄 useNotes mounted, loading notes...');
    loadNotes();
  }, []);

  const addNote = useCallback(async (noteData: Partial<Note>) => {
    const newNote: Note = {
      id: generateId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
      pinned: false,
      fav: false,
      archived: false,
      hasDoodle: false,
      themeIndex: 0,
      moodIndex: null,
      stickerIndex: null,
      _synced: false,
      version: 1,
      ...noteData,
    } as Note;
    
    console.log(`📝 Adding new note: ${newNote.id}`);
    
    const updated = [newNote, ...notes];
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    
    const calculatedStats = calculateStats(updated);
    setStats(calculatedStats);
    
    syncManager.run(updated, (syncedNotes) => {
      setNotes(syncedNotes);
      saveNotesLocally(syncedNotes);
    }).catch(() => {});
    
    return newNote;
  }, [notes]);

  const updateNote = useCallback(async (id: string, noteData: Partial<Note>) => {
    const updated = notes.map(n => 
      n.id === id 
        ? { 
            ...n, 
            ...noteData, 
            updatedAt: new Date().toISOString(), 
            _synced: false,
            version: (n.version || 0) + 1,
          }
        : n
    );
    
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    
    const calculatedStats = calculateStats(updated);
    setStats(calculatedStats);
    
    syncManager.run(updated, (syncedNotes) => {
      setNotes(syncedNotes);
      saveNotesLocally(syncedNotes);
    }).catch(() => {});
    
  }, [notes]);

  const deleteNote = useCallback(async (id: string) => {
    const updated = notes.filter(n => n.id !== id);
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    
    const calculatedStats = calculateStats(updated);
    setStats(calculatedStats);
    
    setTimeout(() => {
      syncManager.deleteFromCloud(id).catch(() => {});
    }, 100);
    
  }, [notes]);

  const togglePin = useCallback(async (id: string) => {
    const updated = notes.map(n => 
      n.id === id ? { ...n, pinned: !n.pinned, _synced: false } : n
    );
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    syncManager.run(updated, (syncedNotes) => {
      setNotes(syncedNotes);
      saveNotesLocally(syncedNotes);
    }).catch(() => {});
  }, [notes]);

  const toggleFav = useCallback(async (id: string) => {
    const updated = notes.map(n => 
      n.id === id ? { ...n, fav: !n.fav, _synced: false } : n
    );
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    syncManager.run(updated, (syncedNotes) => {
      setNotes(syncedNotes);
      saveNotesLocally(syncedNotes);
    }).catch(() => {});
  }, [notes]);

  const toggleArchive = useCallback(async (id: string) => {
    const updated = notes.map(n => 
      n.id === id ? { ...n, archived: !n.archived, _synced: false } : n
    );
    await saveNotesLocally(updated);
    setNotes(updated);
    setDirty(true);
    syncManager.run(updated, (syncedNotes) => {
      setNotes(syncedNotes);
      saveNotesLocally(syncedNotes);
    }).catch(() => {});
  }, [notes]);

  const addLocationToNote = useCallback(async (noteId: string) => {
    const location = await getCurrentLocation();
    if (location) {
      const updated = notes.map(n => 
        n.id === noteId ? { ...n, location, _synced: false } : n
      );
      await saveNotesLocally(updated);
      setNotes(updated);
      setDirty(true);
      return location;
    }
    return null;
  }, [notes]);

  const addWeatherToNote = useCallback(async (noteId: string) => {
    const note = notes.find(n => n.id === noteId);
    if (note?.location) {
      const weather = await getWeather(note.location.latitude, note.location.longitude);
      if (weather) {
        const updated = notes.map(n => 
          n.id === noteId ? { ...n, weather, _synced: false } : n
        );
        await saveNotesLocally(updated);
        setNotes(updated);
        setDirty(true);
        return weather;
      }
    }
    return null;
  }, [notes]);

  const applyTemplate = useCallback((templateId: string): Partial<Note> => {
    const templates = {
      journal: { title: 'Daily Journal', text: 'Today I felt...\n\nI accomplished...\n\nI am grateful for...' },
      gratitude: { title: 'Gratitude', text: 'I am grateful for...\n\n1. \n2. \n3.' },
      idea: { title: 'Idea', text: 'My idea:\n\nWhat problem does it solve?\n\nWho is it for?\n\nNext steps:' },
      dream: { title: 'Dream Journal', text: 'Last night I dreamed...\n\nI felt...\n\nI think this means...' },
      prayer: { title: 'Prayer', text: 'Dear God,\n\nI come to you with...\n\nI ask for...\n\nI thank you for...' },
      love: { title: 'Love Letter', text: 'My dearest,\n\nI wanted to tell you...\n\nYou make me feel...' },
      goals: { title: 'Goals', text: 'My goals:\n\n1. \n2. \n3.\n\nAction steps:' },
    };
    const template = templates[templateId as keyof typeof templates];
    if (!template) return {};
    return {
      title: template.title,
      text: template.text,
      template: templateId,
    };
  }, []);

  const createBackup = useCallback(async () => {
    const backup = {
      version: 1,
      notes,
      folders,
      stats,
      streak,
      exportedAt: new Date().toISOString(),
    };
    return JSON.stringify(backup, null, 2);
  }, [notes, folders, stats, streak]);

  const restoreBackup = useCallback(async (json: string) => {
    try {
      const backup = JSON.parse(json);
      if (backup.notes) {
        await saveNotesLocally(backup.notes);
        setNotes(backup.notes);
        setDirty(true);
        return true;
      }
      return false;
    } catch (error) {
      console.error('Restore backup error:', error);
      return false;
    }
  }, []);

  const exportNotes = useCallback(async () => {
    return JSON.stringify(notes, null, 2);
  }, [notes]);

  const importNotes = useCallback(async (json: string) => {
    try {
      const data = JSON.parse(json);
      const imported = data.notes || data;
      if (Array.isArray(imported) && imported.length > 0) {
        const merged = [...notes, ...imported];
        await saveNotesLocally(merged);
        setNotes(merged);
        setDirty(true);
        return merged;
      }
      return null;
    } catch (error) {
      console.error('Import error:', error);
      return null;
    }
  }, [notes]);

  const quickAction = useCallback(async (noteId: string, action: string) => {
    switch (action) {
      case 'pin': await togglePin(noteId); break;
      case 'heart': await toggleFav(noteId); break;
      case 'archive': await toggleArchive(noteId); break;
      case 'trash': await deleteNote(noteId); break;
    }
  }, [togglePin, toggleFav, toggleArchive, deleteNote]);

  const saveCurrentNotes = useCallback(async () => {
    if (dirty) {
      await saveNotesLocally(notes);
      setDirty(false);
      return true;
    }
    return false;
  }, [notes, dirty]);

// Add this to the return object at the bottom of useNotes.ts

return {
  notes,
  folders,
  stats,
  streak,
  loading,
  dirty,
  loadNotes,
  addNote,
  updateNote,
  deleteNote,
  togglePin,
  toggleFav,
  toggleArchive,
  setNotes,
  saveCurrentNotes,
  quickAction,
  addLocationToNote,
  addWeatherToNote,
  applyTemplate,
  createBackup,
  restoreBackup,
  exportNotes,
  importNotes,
    setNoteReminder,
    completeReminder,
    snoozeReminder,
    getReminderStats,
    checkUpcomingReminders,
    processRecurringReminders,
  isOnline: syncManager.isOnline, // Add this
};
}
