// services/syncManager.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';
import { Note, SyncStatus } from '../types';
import { getDeviceOwnerId, ensureLocalDir } from '../utils/helpers';
import { STORAGE_KEYS } from '../utils/constants';
import { 
  pushNoteToCloud, 
  markNoteDeletedInCloud, 
  fetchAllNotesFromCloud,
  uploadPhotoToSupabase,
  uploadVoiceToSupabase
} from './supabase';
import { downloadToLocal, saveNotesLocally, getLastBackupTime, setLastBackupTime } from './storage';

class SyncManager {
  private syncing = false;
  private listeners: ((status: SyncStatus, lastBackup: string | null) => void)[] = [];
  private idleTimer: ReturnType<typeof setInterval> | null = null;

  subscribe(fn: (status: SyncStatus, lastBackup: string | null) => void) {
    this.listeners.push(fn);
    return () => {
      this.listeners = this.listeners.filter(l => l !== fn);
    };
  }

  private emit(status: SyncStatus, lastBackup: string | null) {
    this.listeners.forEach(l => l(status, lastBackup));
  }

  startIdleSync(callback: () => void, intervalMs = 90000) {
    this.stopIdleSync();
    this.idleTimer = setInterval(callback, intervalMs);
  }

  stopIdleSync() {
    if (this.idleTimer) clearInterval(this.idleTimer);
    this.idleTimer = null;
  }

  async isOnline(): Promise<boolean> {
    try {
      const state = await NetInfo.fetch();
      return !!state.isConnected && state.isInternetReachable !== false;
    } catch {
      return true;
    }
  }

  async run(notes: Note[], onUpdate: (updated: Note[]) => void): Promise<void> {
    if (this.syncing) {
      console.log('🔄 Sync already in progress');
      return;
    }
    
    const online = await this.isOnline();
    if (!online) {
      console.log('📡 Offline - cannot sync');
      this.emit('offline', await getLastBackupTime());
      return;
    }

    console.log('☁️ Starting sync...');
    this.syncing = true;
    this.emit('syncing', await getLastBackupTime());

    try {
      const ownerId = await getDeviceOwnerId();
      let changed = false;
      const updatedNotes = [...notes];

      for (let i = 0; i < updatedNotes.length; i++) {
        const note = updatedNotes[i];
        if (note._synced) continue;

        console.log(`📤 Syncing note: ${note.id}`);
        const noteCopy: Note = { ...note };

        if (noteCopy.photoUri && !noteCopy.photoUri.startsWith('http')) {
          const result = await uploadPhotoToSupabase(noteCopy.photoUri);
          if (result) {
            noteCopy.photoFileName = result.fileName;
            (noteCopy as any)._photoRemoteUrl = result.url;
          }
        }

        if (noteCopy.bgPhotoUri && !noteCopy.bgPhotoUri.startsWith('http')) {
          const result = await uploadPhotoToSupabase(noteCopy.bgPhotoUri);
          if (result) {
            noteCopy.bgPhotoFileName = result.fileName;
            (noteCopy as any)._bgPhotoRemoteUrl = result.url;
          }
        }

        if (noteCopy.voiceNote?.uri && !noteCopy.voiceNote.uri.startsWith('http')) {
          const result = await uploadVoiceToSupabase(noteCopy.voiceNote.uri);
          if (result) {
            noteCopy.voiceFileName = result.fileName;
            (noteCopy as any)._voiceRemoteUrl = result.url;
          }
        }

        const pushed = await pushNoteToCloud(noteCopy, ownerId);
        if (pushed) {
          noteCopy._synced = true;
          updatedNotes[i] = noteCopy;
          changed = true;
          console.log(`✅ Synced note: ${note.id}`);
        }
      }

      if (changed) {
        onUpdate(updatedNotes);
        await saveNotesLocally(updatedNotes);
      }

      const now = new Date().toISOString();
      await setLastBackupTime(now);
      this.emit('synced', now);
      console.log('✅ Sync completed successfully');
      
    } catch (error) {
      console.error('❌ Sync run error:', error);
      this.emit('error', await getLastBackupTime());
    } finally {
      this.syncing = false;
    }
  }

  async restoreFromCloud(): Promise<Note[]> {
    try {
      const online = await this.isOnline();
      if (!online) {
        console.log('📡 Offline - cannot restore from cloud');
        return [];
      }

      console.log('☁️ Restoring from cloud...');
      const ownerId = await getDeviceOwnerId();
      const cloudNotes = await fetchAllNotesFromCloud(ownerId);
      
      if (cloudNotes.length === 0) {
        console.log('ℹ️ No notes found in cloud');
        return [];
      }

      await ensureLocalDir();
      const restored: Note[] = [];

      for (const note of cloudNotes) {
        const restoredNote: Note = { 
          ...note, 
          _synced: true,
          createdAt: note.createdAt || new Date().toISOString(),
          updatedAt: note.updatedAt || new Date().toISOString(),
        };

        if (note.photoUri && note.photoUri.startsWith('http')) {
          const localUri = await downloadToLocal(note.photoUri, `photo_${note.id}.jpg`);
          if (localUri) restoredNote.photoUri = localUri;
        }

        if (note.bgPhotoUri && note.bgPhotoUri.startsWith('http')) {
          const localUri = await downloadToLocal(note.bgPhotoUri, `bg_${note.id}.jpg`);
          if (localUri) restoredNote.bgPhotoUri = localUri;
        }

        if (note.voiceNote?.uri && note.voiceNote.uri.startsWith('http')) {
          const localUri = await downloadToLocal(note.voiceNote.uri, `voice_${note.id}.m4a`);
          if (localUri) restoredNote.voiceNote = { ...note.voiceNote, uri: localUri };
        }

        restored.push(restoredNote);
      }

      console.log(`✅ Restored ${restored.length} notes from cloud`);
      return restored;
      
    } catch (error) {
      console.error('❌ restoreFromCloud error:', error);
      return [];
    }
  }

  async deleteFromCloud(noteId: string) {
    try {
      const ownerId = await getDeviceOwnerId();
      await markNoteDeletedInCloud(noteId, ownerId);
      console.log(`🗑️ Deleted note ${noteId} from cloud`);
    } catch (error) {
      console.error('❌ deleteFromCloud error:', error);
    }
  }
}

export const syncManager = new SyncManager();
