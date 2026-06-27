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

export function useNotes() {
  const [notes, setNotes] = useState<Note[]>([]);
  const [folders, setFolders] = useState<Folder[]>([]);
  const [stats, setStats] = useState<NoteStats | null>(null);
  const [streak, setStreak] = useState<StreakData | null>(null);
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);

  const loadNotes = useCallback(async () => {
    try {
      setLoading(true);
      console.log('📂 Loading notes from local storage...');
      
      const localNotes = await loadNotesLocally();
      
      if (localNotes.length > 0) {
        console.log(`✅ Loaded ${localNotes.length} notes from local storage`);
        const migratedNotes = await migrateNotes(localNotes);
        setNotes(migratedNotes);
        
        const calculatedStats = calculateStats(migratedNotes);
        setStats(calculatedStats);
        
        const streakData: StreakData = {
          currentStreak: calculateStreak(migratedNotes),
          longestStreak: 0,
          lastWrittenDate: migratedNotes.length > 0 ? migratedNotes[0].createdAt : new Date().toISOString(),
          history: migratedNotes.map(n => ({ 
            date: new Date(n.createdAt).toDateString(), 
            count: 1 
          })),
        };
        setStreak(streakData);
        
        setLoading(false);
        console.log('✅ Loading complete - notes found locally');
        
        setTimeout(async () => {
          try {
            console.log('☁️ Syncing with cloud...');
            await syncManager.run(migratedNotes, (syncedNotes) => {
              if (syncedNotes.length > migratedNotes.length) {
                console.log(`💾 Synced ${syncedNotes.length} notes from cloud`);
                setNotes(syncedNotes);
                saveNotesLocally(syncedNotes);
              }
            });
          } catch (error) {
            console.error('Background sync error:', error);
          }
        }, 1000);
        
        return;
      }
      
      console.log('📭 No local notes found, trying cloud restore...');
      const restored = await syncManager.restoreFromCloud();
      if (restored.length > 0) {
        console.log(`☁️ Restored ${restored.length} notes from cloud`);
        const migratedNotes = await migrateNotes(restored);
        await saveNotesLocally(migratedNotes);
        setNotes(migratedNotes);
        setLoading(false);
        console.log('✅ Loading complete - restored from cloud');
      } else {
        console.log('📭 No notes found anywhere');
        setNotes([]);
        setLoading(false);
        console.log('✅ Loading complete - no notes found');
      }
    } catch (error) {
      console.error('❌ Load notes error:', error);
      setNotes([]);
      setLoading(false);
    }
  }, []);

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
  };
}
