// services/storage.ts
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system/legacy';
import { STORAGE_KEYS } from '../utils/constants';
import { ensureLocalDir, LOCAL_FILES_DIR } from '../utils/helpers';
import { Note } from '../types';

export async function saveNotesLocally(notes: Note[]): Promise<void> {
  try {
    const json = JSON.stringify(notes);
    await AsyncStorage.setItem(STORAGE_KEYS.NOTES, json);
    console.log(`✅ Saved ${notes.length} notes to local storage`);
  } catch (error) {
    console.error('❌ Failed to save notes locally:', error);
    throw error;
  }
}

export async function loadNotesLocally(): Promise<Note[]> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
    if (cached) {
      const notes = JSON.parse(cached);
      console.log(`✅ Loaded ${notes.length} notes from local storage`);
      return notes;
    }
    console.log('ℹ️ No notes found in local storage');
    return [];
  } catch (error) {
    console.error('❌ Failed to load notes locally:', error);
    return [];
  }
}

// services/storage.ts - Add a debug function

export async function debugLocalStorage(): Promise<void> {
  try {
    const cached = await AsyncStorage.getItem(STORAGE_KEYS.NOTES);
    if (cached) {
      const notes = JSON.parse(cached);
      console.log(`🔍 Local storage has ${notes.length} notes`);
      if (notes.length > 0) {
        console.log(`📝 First note: ${notes[0].id} - ${notes[0].title || 'Untitled'}`);
      }
    } else {
      console.log('🔍 Local storage is empty');
    }
  } catch (error) {
    console.error('Debug error:', error);
  }
}

export async function downloadToLocal(remoteUrl: string, suggestedName: string): Promise<string | null> {
  try {
    await ensureLocalDir();
    const localPath = LOCAL_FILES_DIR + suggestedName;
    const existing = await FileSystem.getInfoAsync(localPath);
    if (existing.exists) return localPath;
    const result = await FileSystem.downloadAsync(remoteUrl, localPath);
    return result.uri;
  } catch (error) {
    console.error('Download error:', error);
    return null;
  }
}

export async function getLastBackupTime(): Promise<string | null> {
  return await AsyncStorage.getItem(STORAGE_KEYS.LAST_BACKUP);
}

export async function setLastBackupTime(time: string): Promise<void> {
  await AsyncStorage.setItem(STORAGE_KEYS.LAST_BACKUP, time);
}

export async function clearAllLocalNotes(): Promise<void> {
  await AsyncStorage.removeItem(STORAGE_KEYS.NOTES);
  console.log('🗑️ Cleared all local notes');
}

export async function getLocalFilePath(fileName: string): Promise<string> {
  await ensureLocalDir();
  return LOCAL_FILES_DIR + fileName;
}

export async function fileExists(fileName: string): Promise<boolean> {
  try {
    const path = LOCAL_FILES_DIR + fileName;
    const info = await FileSystem.getInfoAsync(path);
    return info.exists;
  } catch {
    return false;
  }
}

export async function deleteLocalFile(fileName: string): Promise<boolean> {
  try {
    const path = LOCAL_FILES_DIR + fileName;
    const info = await FileSystem.getInfoAsync(path);
    if (info.exists) {
      await FileSystem.deleteAsync(path);
      console.log(`🗑️ Deleted file: ${fileName}`);
      return true;
    }
    return false;
  } catch (error) {
    console.error('❌ Delete file error:', error);
    return false;
  }
}
