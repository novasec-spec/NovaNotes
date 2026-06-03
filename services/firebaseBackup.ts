// services/firebaseBackup.ts
import { db, storage } from '../config/firebase';
import { collection, doc, setDoc, getDoc, updateDoc, arrayUnion } from 'firebase/firestore';
import { ref, uploadString, getDownloadURL } from 'firebase/storage';
import AsyncStorage from '@react-native-async-storage/async-storage';
import * as FileSystem from 'expo-file-system';

export class FirebaseBackup {
  private userId: string;

  constructor(userId: string) {
    this.userId = userId;
  }

  async backupAllData() {
    try {
      // Get all local data
      const notes = await AsyncStorage.getItem('loveNotes');
      const memories = await AsyncStorage.getItem('memories');
      const moodHistory = await AsyncStorage.getItem('moodHistory');
      const secretMessages = await AsyncStorage.getItem('secretMessages');

      // Upload to Firebase
      const userDocRef = doc(db, 'userData', this.userId);
      await setDoc(userDocRef, {
        notes: notes ? JSON.parse(notes) : [],
        moodHistory: moodHistory ? JSON.parse(moodHistory) : [],
        secretMessages: secretMessages ? JSON.parse(secretMessages) : [],
        lastBackup: new Date().toISOString(),
      }, { merge: true });

      // Backup images separately
      if (memories) {
        const memoriesArray = JSON.parse(memories);
        for (const memory of memoriesArray) {
          if (!memory.backedUp) {
            const imageRef = ref(storage, `memories/${this.userId}/${memory.id}.jpg`);
            const base64 = await FileSystem.readAsStringAsync(memory.uri, { encoding: 'base64' });
            await uploadString(imageRef, base64, 'base64');
            const url = await getDownloadURL(imageRef);
            
            // Update memory with cloud URL
            memory.cloudUrl = url;
            memory.backedUp = true;
          }
        }
        await setDoc(userDocRef, { memories: memoriesArray }, { merge: true });
      }

      console.log('Backup completed successfully!');
      return true;
    } catch (error) {
      console.error('Backup failed:', error);
      return false;
    }
  }

  async restoreFromBackup() {
    try {
      const userDocRef = doc(db, 'userData', this.userId);
      const docSnap = await getDoc(userDocRef);
      
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        await AsyncStorage.setItem('loveNotes', JSON.stringify(data.notes || []));
        await AsyncStorage.setItem('moodHistory', JSON.stringify(data.moodHistory || []));
        await AsyncStorage.setItem('secretMessages', JSON.stringify(data.secretMessages || []));
        
        console.log('Restore completed!');
        return true;
      }
      return false;
    } catch (error) {
      console.error('Restore failed:', error);
      return false;
    }
  }

  async syncMood(moodEntry: any) {
    try {
      const userDocRef = doc(db, 'userData', this.userId);
      await updateDoc(userDocRef, {
        moodHistory: arrayUnion(moodEntry)
      });
    } catch (error) {
      console.error('Mood sync failed:', error);
    }
  }
}
