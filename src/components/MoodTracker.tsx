// components/MoodTracker.tsx - FIXED
import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';

const moods = [
  {
    label: 'Happy',
    icon: 'happy-outline',
    color: '#FFD700'
  },
  {
    label: 'Loved',
    icon: 'heart-outline',
    color: '#FF6B9D'
  },
  {
    label: 'Relaxed',
    icon: 'leaf-outline',
    color: '#87CEEB'
  },
  {
    label: 'Thoughtful',
    icon: 'bulb-outline',
    color: '#DDA0DD'
  },
  {
    label: 'Sad',
    icon: 'sad-outline',
    color: '#6495ED'
  },
  {
    label: 'Frustrated',
    icon: 'flame-outline',
    color: '#FF6347'
  },
];

export default function MoodTracker({ onMoodSelect }) {
  const [selectedMood, setSelectedMood] = useState(null);
  const { colors, isDarkMode } = useTheme();

  const handleMoodPress = async (mood) => {
    setSelectedMood(mood);
    const moodEntry = {
      mood: mood.label,
      icon: mood.icon,
      timestamp: new Date().toISOString(),
    };

    // Save locally
    const existing = await AsyncStorage.getItem('moodHistory');
    const history = existing ? JSON.parse(existing) : [];
    history.push(moodEntry);
    await AsyncStorage.setItem('moodHistory', JSON.stringify(history));

    onMoodSelect?.(mood);
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <Text style={[styles.title, { color: colors.text }]}>
        How are you feeling today?
      </Text>
      <View style={[styles.moodGrid, { backgroundColor: colors.card }]}>
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
            {/* ✅ FIX: Use Icon component instead of Text */}
            <Icon name={mood.icon} size={32} color={mood.color} />
            <Text style={[styles.moodLabel, { color: colors.text }]}>
              {mood.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { 
    padding: 20,
    borderRadius: 16,
    marginHorizontal: 16,
    marginVertical: 8,
  },
  title: { 
    fontSize: 20, 
    fontWeight: '600', 
    textAlign: 'center', 
    marginBottom: 20 
  },
  moodGrid: { 
    flexDirection: 'row', 
    flexWrap: 'wrap', 
    justifyContent: 'center', 
    gap: 12,
    padding: 16,
    borderRadius: 16,
  },
  moodButton: { 
    alignItems: 'center', 
    padding: 14, 
    borderRadius: 16, 
    minWidth: 80,
    gap: 6,
  },
  selected: { 
    borderWidth: 2, 
    borderColor: '#FF6B9D',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.2,
    shadowRadius: 4,
    elevation: 3,
  },
  moodLabel: { 
    marginTop: 4, 
    fontSize: 12,
    fontWeight: '500',
  },
});
