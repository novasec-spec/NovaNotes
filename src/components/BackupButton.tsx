// components/BackupButton.tsx
import React, { useState } from 'react';
import { View, TouchableOpacity, Text, StyleSheet, Alert, ActivityIndicator } from 'react-native';
import { FirebaseBackup } from '../services/firebaseBackup';

export default function BackupButton({ userId }) {
  const [backingUp, setBackingUp] = useState(false);
  const backup = new FirebaseBackup(userId);

  const handleBackup = async () => {
    setBackingUp(true);
    const success = await backup.backupAllData();
    setBackingUp(false);
    
    Alert.alert(
      success ? 'Backup Complete ✅' : 'Backup Failed ❌',
      success ? 'All your memories are safely stored!' : 'Please check your internet connection'
    );
  };

  return (
    <TouchableOpacity style={styles.button} onPress={handleBackup} disabled={backingUp}>
      {backingUp ? (
        <ActivityIndicator color="#fff" />
      ) : (
        <Text style={styles.buttonText}>💾 Backup All Memories</Text>
      )}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  button: { backgroundColor: '#FF6B9D', padding: 15, borderRadius: 25, alignItems: 'center', margin: 20 },
  buttonText: { color: '#fff', fontWeight: '600', fontSize: 16 },
});
