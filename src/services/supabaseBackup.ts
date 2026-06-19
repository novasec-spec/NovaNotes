// services/supabaseBackup.ts - COMPLETE WORKING VERSION
import { supabase } from '../config/supabase';
import AsyncStorage from '@react-native-async-storage/async-storage';

export class SupabaseBackup {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async backupAllData() {
    try {
      console.log('📤 Starting backup for user:', this.userId);
      
      // Get all local data
      const [notes, memories, moodHistory, secretMessages, journalEntries] = await Promise.all([
        AsyncStorage.getItem('loveNotes'),
        AsyncStorage.getItem('memories'),
        AsyncStorage.getItem('moodHistory'),
        AsyncStorage.getItem('secretMessages'),
        AsyncStorage.getItem('journalEntries')
      ]);

      const backupData = {
        user_id: this.userId,
        notes: notes ? JSON.parse(notes) : [],
        memories: memories ? JSON.parse(memories) : [],
        mood_history: moodHistory ? JSON.parse(moodHistory) : [],
        secret_messages: secretMessages ? JSON.parse(secretMessages) : [],
        journal_entries: journalEntries ? JSON.parse(journalEntries) : [],
        last_backup: new Date().toISOString(),
      };

      console.log('📦 Data to backup:', {
        notesCount: backupData.notes.length,
        memoriesCount: backupData.memories.length
      });

      // Try to insert or update
      const { error } = await supabase
        .from('user_data')
        .upsert(backupData, { 
          onConflict: 'user_id',
          ignoreDuplicates: false 
        });

      if (error) {
        console.error('❌ Supabase error:', error);
        return false;
      }

      console.log('✅ Backup successful!');
      return true;
    } catch (error) {
      console.error('❌ Backup error:', error);
      return false;
    }
  }


// services/supabaseBackup.ts - Add these methods

async savePushToken(token: string) {
  try {
    const { error } = await supabase
      .from('user_data')
      .upsert({
        user_id: this.userId,
        push_token: token,
        last_token_update: new Date().toISOString(),
      }, { onConflict: 'user_id' });

    if (error) throw error;
    console.log('Push token saved successfully');
    return true;
  } catch (error) {
    console.error('Failed to save push token:', error);
    return false;
  }
}

async getPushToken(): Promise<string | null> {
  try {
    const { data, error } = await supabase
      .from('user_data')
      .select('push_token')
      .eq('user_id', this.userId)
      .single();

    if (error) throw error;
    return data?.push_token || null;
  } catch (error) {
    console.error('Failed to get push token:', error);
    return null;
  }
}



  async restoreFromBackup() {
    try {
      console.log('📥 Starting restore for user:', this.userId);
      
      const { data, error } = await supabase
        .from('user_data')
        .select('*')
        .eq('user_id', this.userId)
        .single();

      if (error) {
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No existing backup found');
          return true;
        }
        throw error;
      }
      
      if (data) {
        if (data.notes) await AsyncStorage.setItem('loveNotes', JSON.stringify(data.notes));
        if (data.mood_history) await AsyncStorage.setItem('moodHistory', JSON.stringify(data.mood_history));
        if (data.secret_messages) await AsyncStorage.setItem('secretMessages', JSON.stringify(data.secret_messages));
        if (data.memories) await AsyncStorage.setItem('memories', JSON.stringify(data.memories));
        if (data.journal_entries) await AsyncStorage.setItem('journalEntries', JSON.stringify(data.journal_entries));

        console.log('✅ Restore successful!');
        return true;
      }
      
      return true;
    } catch (error) {
      console.error('❌ Restore error:', error);
      return false;
    }
  }
}
