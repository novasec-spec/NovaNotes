// services/supabase.ts
import { supabase } from '../../../../config/supabase';
import { BUCKET_NAME } from '../utils/constants';
import { Note } from '../types';
import * as FileSystem from 'expo-file-system/legacy';

export async function uploadFileToSupabase(
  fileUri: string,
  folder: string,
  contentType: string,
  ext: string
): Promise<{ url: string; fileName: string } | null> {
  try {
    const base64 = await FileSystem.readAsStringAsync(fileUri, {
      encoding: FileSystem.EncodingType.Base64,
    });

    const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${ext}`;

    const byteCharacters = atob(base64);
    const byteNumbers = new Array(byteCharacters.length);
    for (let i = 0; i < byteCharacters.length; i++) {
      byteNumbers[i] = byteCharacters.charCodeAt(i);
    }
    const byteArray = new Uint8Array(byteNumbers);

    const { error } = await supabase.storage.from(BUCKET_NAME).upload(fileName, byteArray, {
      contentType,
      cacheControl: '3600',
      upsert: true,
    });

    if (error) throw error;

    const { data: urlData } = supabase.storage.from(BUCKET_NAME).getPublicUrl(fileName);

    return { url: urlData.publicUrl, fileName };
  } catch (error) {
    console.error('Upload error:', error);
    return null;
  }
}

export async function uploadPhotoToSupabase(uri: string) {
  const ext = uri.split('.').pop() || 'jpg';
  return uploadFileToSupabase(uri, 'photos', `image/${ext}`, ext);
}

export async function uploadVoiceToSupabase(uri: string) {
  return uploadFileToSupabase(uri, 'voice', 'audio/m4a', 'm4a');
}

export async function pushNoteToCloud(note: Note, ownerId: string): Promise<boolean> {
  try {
    const { error } = await supabase.from('notes').upsert({
      id: note.id,
      owner_id: ownerId,
      payload: note,
      updated_at: note.updatedAt,
      deleted: false,
    });
    if (error) {
      console.error('pushNoteToCloud error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('pushNoteToCloud error:', error);
    return false;
  }
}

export async function markNoteDeletedInCloud(noteId: string, ownerId: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .update({ deleted: true })
      .eq('id', noteId)
      .eq('owner_id', ownerId);
    if (error) {
      console.error('markNoteDeletedInCloud error:', error);
      return false;
    }
    return true;
  } catch (error) {
    console.error('markNoteDeletedInCloud error:', error);
    return false;
  }
}

export async function fetchAllNotesFromCloud(ownerId: string): Promise<Note[]> {
  try {
    const { data, error } = await supabase
      .from('notes')
      .select('payload')
      .eq('owner_id', ownerId)
      .eq('deleted', false)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('fetchAllNotesFromCloud error:', error);
      return [];
    }
    
    return (data || []).map((row: any) => row.payload as Note);
  } catch (error) {
    console.error('fetchAllNotesFromCloud error:', error);
    return [];
  }
}
