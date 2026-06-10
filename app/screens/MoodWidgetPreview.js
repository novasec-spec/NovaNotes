import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { updateWidget, refreshWidget, getWidgetData } from '../widget/widgetSync';
import { saveMood, getTodayMood, MOODS, setupSpecialDate } from '../widget/dataManager';

export default function MoodWidgetPreview() {
  const [currentMood, setCurrentMood] = useState(null);
  const [isUpdating, setIsUpdating] = useState(false);
  const [widgetStatus, setWidgetStatus] = useState('unknown');

  useEffect(() => {
    loadCurrentMood();
    checkWidgetStatus();
  }, []);

  const loadCurrentMood = async () => {
    const mood = await getTodayMood();
    setCurrentMood(mood);
  };

  const checkWidgetStatus = () => {
    const data = getWidgetData();
    setWidgetStatus(data ? 'active' : 'inactive');
  };

  const handleMoodSelect = async (moodKey, moodData) => {
    setIsUpdating(true);
    try {
      // Save mood
      await saveMood(moodData.name, moodData.emoji);
      
      // Update widget
      const success = await updateWidget();
      
      if (success) {
        Alert.alert('Success', `Mood set to ${moodData.name}! Widget updated.`);
        await loadCurrentMood();
      } else {
        Alert.alert('Error', 'Failed to update widget. Please try again.');
      }
    } catch (error) {
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleRefreshWidget = async () => {
    setIsUpdating(true);
    const success = refreshWidget();
    if (success) {
      Alert.alert('Refreshed', 'Widget refresh triggered!');
      await updateWidget(); // Also update with latest data
    }
    setIsUpdating(false);
  };

  const setupExampleSpecialDate = async () => {
    // Example: Set a special date (change this to your actual special date)
    const specialDate = '2024-01-01'; // YYYY-MM-DD
    const specialName = 'New Year';
    const type = 'since'; // or 'until'
    
    await setupSpecialDate(specialDate, specialName, type);
    await updateWidget();
    Alert.alert('Setup', 'Special date configured! Check your widget.');
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Today's Mood</Text>
      
      {currentMood && (
        <View style={styles.currentMood}>
          <Text style={styles.currentMoodEmoji}>{currentMood.emoji}</Text>
          <Text style={styles.currentMoodText}>{currentMood.mood}</Text>
          {!currentMood.isToday && (
            <Text style={styles.notSetText}>Not set for today yet</Text>
          )}
        </View>
      )}

      <Text style={styles.sectionTitle}>Select Your Mood:</Text>
      
      <View style={styles.moodGrid}>
        {Object.entries(MOODS).map(([key, mood]) => (
          <TouchableOpacity
            key={key}
            style={[styles.moodButton, { backgroundColor: mood.color }]}
            onPress={() => handleMoodSelect(key, mood)}
            disabled={isUpdating}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={styles.moodName}>{mood.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      <View style={styles.actionButtons}>
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshWidget}
          disabled={isUpdating}
        >
          <Text style={styles.buttonText}>
            {isUpdating ? 'Updating...' : 'Refresh Widget'}
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={styles.setupButton}
          onPress={setupExampleSpecialDate}
        >
          <Text style={styles.buttonText}>Setup Example Special Date</Text>
        </TouchableOpacity>
      </View>

      {isUpdating && <ActivityIndicator size="large" color="#007AFF" />}
      
      <Text style={styles.widgetStatus}>
        Widget Status: {widgetStatus === 'active' ? '✅ Active' : '⚠️ Check widget on home screen'}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: '#f5f5f5',
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    textAlign: 'center',
    marginBottom: 20,
    color: '#333',
  },
  currentMood: {
    alignItems: 'center',
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 15,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  currentMoodEmoji: {
    fontSize: 48,
  },
  currentMoodText: {
    fontSize: 20,
    fontWeight: '600',
    marginTop: 8,
    color: '#333',
  },
  notSetText: {
    fontSize: 14,
    color: '#999',
    marginTop: 5,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    marginBottom: 15,
    color: '#555',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    marginBottom: 20,
  },
  moodButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.2,
    shadowRadius: 2,
    elevation: 2,
  },
  moodEmoji: {
    fontSize: 28,
  },
  moodName: {
    fontSize: 11,
    fontWeight: '500',
    marginTop: 4,
    color: 'white',
  },
  actionButtons: {
    gap: 10,
  },
  refreshButton: {
    backgroundColor: '#007AFF',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  setupButton: {
    backgroundColor: '#34C759',
    padding: 15,
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: 'white',
    fontSize: 16,
    fontWeight: '600',
  },
  widgetStatus: {
    textAlign: 'center',
    marginTop: 20,
    fontSize: 12,
    color: '#666',
  },
});
