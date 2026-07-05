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

// Use user_email instead of owner_id
export async function pushNoteToCloud(note: Note, userEmail: string): Promise<boolean> {
  try {

const {
  data: { user },
} = await supabase.auth.getUser();

if (!user) {
  console.error("No authenticated user");
  return false;
}

    console.log(`📤 Pushing note for user: ${userEmail}`);
    const { error } = await supabase.from('notes').upsert({
      id: note.id,
     owner_id: user.id, 
     user_email: userEmail,  // Changed from owner_id
      payload: note,
      updated_at: note.updatedAt,
      deleted: false,
    });
    if (error) {
      console.error('pushNoteToCloud error:', error);
      return false;
    }
    console.log(`✅ Note pushed: ${note.id}`);
    return true;
  } catch (error) {
    console.error('pushNoteToCloud error:', error);
    return false;
  }
}

export async function markNoteDeletedInCloud(noteId: string, userEmail: string): Promise<boolean> {
  try {
    const { error } = await supabase
      .from('notes')
      .update({ deleted: true })
      .eq('id', noteId)
      .eq('user_email', userEmail);  // Changed from owner_id
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

export async function fetchAllNotesFromCloud(userEmail: string): Promise<Note[]> {
  try {
    console.log(`🔍 Fetching notes for user: ${userEmail}`);
    const { data, error } = await supabase
      .from('notes')
      .select('payload')
      .eq('user_email', userEmail)  // Changed from owner_id
      .eq('deleted', false)
      .order('updated_at', { ascending: false });
      
    if (error) {
      console.error('fetchAllNotesFromCloud error:', error);
      return [];
    }
    
    const notes = (data || []).map((row: any) => row.payload as Note);
    console.log(`✅ Fetched ${notes.length} notes`);
    return notes;
  } catch (error) {
    console.error('fetchAllNotesFromCloud error:', error);
    return [];
  }
}
