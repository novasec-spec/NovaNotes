// components/MoodTracker.tsx
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

const moods = [
  { emoji: '😊', label: 'Happy', color: '#FFD700' },
  { emoji: '🥰', label: 'Loved', color: '#FF6B9D' },
  { emoji: '😌', label: 'Relaxed', color: '#87CEEB' },
  { emoji: '🤔', label: 'Thoughtful', color: '#DDA0DD' },
  { emoji: '😢', label: 'Sad', color: '#6495ED' },
  { emoji: '😤', label: 'Frustrated', color: '#FF6347' },
];

export default function MoodTracker({ onMoodSelect }) {
  const [selectedMood, setSelectedMood] = useState(null);

  const handleMoodPress = async (mood) => {
    setSelectedMood(mood);
    const moodEntry = {
      mood: mood.label,
      emoji: mood.emoji,
      timestamp: new Date().toISOString(),
    };
    
    // Save locally
    const existing = await AsyncStorage.getItem('moodHistory');
    const history = existing ? JSON.parse(existing) : [];
    history.push(moodEntry);
    await AsyncStorage.setItem('moodHistory', JSON.stringify(history));
    
    // Save to Firebase
    // await addDoc(collection(db, 'moods'), moodEntry);
    
    onMoodSelect?.(mood);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>How are you feeling today?</Text>
      <View style={styles.moodGrid}>
        {moods.map((mood) => (
          <TouchableOpacity
            key={mood.label}
            style={[
              styles.moodButton,
              selectedMood?.label === mood.label && styles.selected,
              { backgroundColor: mood.color + '20' }
            ]}
            onPress={() => handleMoodPress(mood)}
          >
            <Text style={styles.emoji}>{mood.emoji}</Text>
            <Text style={styles.moodLabel}>{mood.label}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { padding: 20, backgroundColor: '#fff' },
  title: { fontSize: 20, fontWeight: '600', textAlign: 'center', marginBottom: 20 },
  moodGrid: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 15 },
  moodButton: { alignItems: 'center', padding: 12, borderRadius: 12, minWidth: 80 },
  selected: { borderWidth: 2, borderColor: '#FF6B9D' },
  emoji: { fontSize: 32 },
  moodLabel: { marginTop: 5, fontSize: 12 },
});
