import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
  ScrollView,
} from 'react-native';
import { saveMood, updateWidget, initializeWidget } from '../widget/widgetSync';

// Mood options with colors
const MOODS = [
  { name: 'Great', emoji: '😊', color: '#4CAF50' },
  { name: 'Good', emoji: '🙂', color: '#8BC34A' },
  { name: 'Okay', emoji: '😐', color: '#FFC107' },
  { name: 'Bad', emoji: '😕', color: '#FF9800' },
  { name: 'Awful', emoji: '😢', color: '#F44336' },
];

export default function HomeScreen() {
  const [loading, setLoading] = useState(false);
  const [todayMood, setTodayMood] = useState(null);

  useEffect(() => {
    // Initialize widget on app start
    initializeWidget();
  }, []);

  const handleMoodSelect = async (mood) => {
    setLoading(true);
    try {
      // Save mood and update widget
      const result = await saveMood(mood.name, mood.emoji);
      
      if (result.success) {
        setTodayMood(mood);
        
        // Show success message
        Alert.alert(
          'Mood Saved! 🎉',
          `Your mood: ${mood.name} ${mood.emoji}\nStreak: ${result.streak} day${result.streak !== 1 ? 's' : ''} in a row!\n\nWidget updated on home screen!`,
          [{ text: 'Awesome!', style: 'default' }]
        );
      } else {
        Alert.alert('Error', 'Failed to save mood. Please try again.');
      }
    } catch (error) {
      console.error('Error:', error);
      Alert.alert('Error', 'Something went wrong.');
    } finally {
      setLoading(false);
    }
  };

  const handleRefreshWidget = async () => {
    setLoading(true);
    await updateWidget();
    Alert.alert('Refreshed', 'Widget data has been refreshed!');
    setLoading(false);
  };

  return (
    <ScrollView style={styles.container}>
      {/* Hero Section */}
      <View style={styles.heroSection}>
        <Text style={styles.title}>How are you feeling? 💭</Text>
        <Text style={styles.subtitle}>Track your mood and build your streak</Text>
      </View>

      {/* Mood Grid */}
      <View style={styles.moodGrid}>
        {MOODS.map((mood) => (
          <TouchableOpacity
            key={mood.name}
            style={[styles.moodButton, { backgroundColor: mood.color }]}
            onPress={() => handleMoodSelect(mood)}
            disabled={loading}
          >
            <Text style={styles.moodEmoji}>{mood.emoji}</Text>
            <Text style={styles.moodName}>{mood.name}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {/* Today's Mood Display */}
      {todayMood && (
        <View style={styles.todayMoodCard}>
          <Text style={styles.cardTitle}>Today's Mood</Text>
          <Text style={styles.todayMood}>
            {todayMood.emoji} {todayMood.name}
          </Text>
        </View>
      )}

      {/* Widget Info Card */}
      <View style={styles.infoCard}>
        <Text style={styles.cardTitle}>📱 Home Screen Widget</Text>
        <Text style={styles.infoText}>
          Your mood widget is ready! Add it to your home screen:
        </Text>
        <Text style={styles.steps}>
          1️⃣ Long press on home screen{'\n'}
          2️⃣ Tap "Widgets"{'\n'}
          3️⃣ Find "Mood Tracker"{'\n'}
          4️⃣ Drag to your home screen
        </Text>
        
        <TouchableOpacity
          style={styles.refreshButton}
          onPress={handleRefreshWidget}
          disabled={loading}
        >
          <Text style={styles.refreshButtonText}>
            {loading ? 'Updating...' : '🔄 Refresh Widget'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Tips Section */}
      <View style={styles.tipsCard}>
        <Text style={styles.cardTitle}>💡 Pro Tips</Text>
        <Text style={styles.tipText}>• Check in daily to increase your streak</Text>
        <Text style={styles.tipText}>• Widget shows a new quote every day</Text>
        <Text style={styles.tipText}>• Share your mood with your loved one</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f8f9fa',
  },
  heroSection: {
    padding: 30,
    alignItems: 'center',
    backgroundColor: '#FF6B6B',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
  },
  title: {
    fontSize: 28,
    fontWeight: 'bold',
    color: 'white',
    marginBottom: 8,
  },
  subtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.9)',
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    padding: 20,
  },
  moodButton: {
    width: '18%',
    aspectRatio: 1,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 3,
  },
  moodEmoji: {
    fontSize: 32,
    marginBottom: 4,
  },
  moodName: {
    fontSize: 12,
    color: 'white',
    fontWeight: '600',
  },
  todayMoodCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 2,
    elevation: 2,
  },
  todayMood: {
    fontSize: 32,
    fontWeight: 'bold',
    marginTop: 10,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: 'bold',
    color: '#333',
    marginBottom: 10,
  },
  infoCard: {
    backgroundColor: 'white',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#E0E0E0',
  },
  infoText: {
    fontSize: 14,
    color: '#666',
    marginBottom: 12,
  },
  steps: {
    fontSize: 13,
    color: '#555',
    lineHeight: 20,
    marginBottom: 15,
    fontFamily: 'monospace',
  },
  refreshButton: {
    backgroundColor: '#FF6B6B',
    padding: 12,
    borderRadius: 10,
    alignItems: 'center',
    marginTop: 5,
  },
  refreshButtonText: {
    color: 'white',
    fontSize: 14,
    fontWeight: '600',
  },
  tipsCard: {
    backgroundColor: '#FFF3E0',
    margin: 20,
    padding: 20,
    borderRadius: 15,
    marginBottom: 30,
  },
  tipText: {
    fontSize: 13,
    color: '#666',
    marginBottom: 8,
    lineHeight: 20,
  },
});
