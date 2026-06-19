// screens/MoodMusicScreen.tsx - Full Music & Mood Experience
import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  Alert, Image, Linking
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Icon from 'react-native-vector-icons/Ionicons';
import * as WebBrowser from 'expo-web-browser';
import { router } from 'expo-router';

// Mood-based song recommendations
const moodSongs = {
  'Happy': [
    { title: 'Happy', artist: 'Pharrell Williams', uri: 'https://open.spotify.com/track/60nZcImufyMA1MKQY3dcCH' },
    { title: 'Can\'t Stop The Feeling', artist: 'Justin Timberlake', uri: 'https://open.spotify.com/track/1WkMMavIMc4JZ8cfMmxHkI' },
    { title: 'Good as Hell', artist: 'Lizzo', uri: 'https://open.spotify.com/track/6uL5HWdM6wqDqjUky1K3sN' },
    { title: 'Uptown Funk', artist: 'Mark Ronson ft. Bruno Mars', uri: 'https://open.spotify.com/track/32OlwWuMpZ6b0aN2RZOeMS' },
  ],
  'Loved': [
    { title: 'Perfect', artist: 'Ed Sheeran', uri: 'https://open.spotify.com/track/0tgVpDi06FyKpA1z0VMD4v' },
    { title: 'All of Me', artist: 'John Legend', uri: 'https://open.spotify.com/track/3U4isOIWM3VvDubwSI3y7a' },
    { title: 'Thinking Out Loud', artist: 'Ed Sheeran', uri: 'https://open.spotify.com/track/34gCuhDGsG4fbRPGo9r1b5' },
    { title: 'At My Worst', artist: 'Pink Sweat$', uri: 'https://open.spotify.com/track/0ri0Han4IRJXzvq18YOxgX' },
  ],
  'Relaxed': [
    { title: 'Weightless', artist: 'Marconi Union', uri: 'https://open.spotify.com/track/78vWHxKWfWBsI5dY4p6QjV' },
    { title: 'Clair de Lune', artist: 'Debussy', uri: 'https://open.spotify.com/track/5uM5fv6i2CZMkAvQxf70ow' },
    { title: 'Sunset Lover', artist: 'Petit Biscuit', uri: 'https://open.spotify.com/track/0hNduWmlWmEmuwEFcYvRu1' },
    { title: 'Breathe', artist: 'Telepopmusik', uri: 'https://open.spotify.com/track/7i3xwF2BLs7qNyZ2JqCGOI' },
  ],
  'Thoughtful': [
    { title: 'Someone Like You', artist: 'Adele', uri: 'https://open.spotify.com/track/1krpe5pQ12GpR9Yck3wzNV' },
    { title: 'Fix You', artist: 'Coldplay', uri: 'https://open.spotify.com/track/7LVHVU3tWfcxj5aiPFEW4Q' },
    { title: 'The Scientist', artist: 'Coldplay', uri: 'https://open.spotify.com/track/75JFxkI2RXiU7L9VXzMtic' },
    { title: 'Someone You Loved', artist: 'Lewis Capaldi', uri: 'https://open.spotify.com/track/7qEHsqek33rTcFNT9PFqLf' },
  ],
  'Sad': [
    { title: 'Someone Like You', artist: 'Adele', uri: 'https://open.spotify.com/track/1krpe5pQ12GpR9Yck3wzNV' },
    { title: 'Fix You', artist: 'Coldplay', uri: 'https://open.spotify.com/track/7LVHVU3tWfcxj5aiPFEW4Q' },
    { title: 'The Night We Met', artist: 'Lord Huron', uri: 'https://open.spotify.com/track/0QZ5yyl6B6utIWkxeBDxQN' },
    { title: 'Liability', artist: 'Lorde', uri: 'https://open.spotify.com/track/6Kkt27YmFyIFrcX3QXFi2o' },
  ],
  'Frustrated': [
    { title: 'Fight Song', artist: 'Rachel Platten', uri: 'https://open.spotify.com/track/37f4ITSlgPX81ad2EvmVQr' },
    { title: 'Roar', artist: 'Katy Perry', uri: 'https://open.spotify.com/track/27tNWlhdAryQY04Gb2ZhUI' },
    { title: 'Stronger', artist: 'Kelly Clarkson', uri: 'https://open.spotify.com/track/1gudfKqkR0bRlq7FfDvm5F' },
    { title: 'Unstoppable', artist: 'Sia', uri: 'https://open.spotify.com/track/1yvMUkIOTeUNtNWlWRgANS' },
  ],
};

// Our special song
const OUR_SONG = {
  title: "Perfect",
  artist: "Ed Sheeran",
  uri: "https://open.spotify.com/track/0tgVpDi06FyKpA1z0VMD4v",
};

export default function MoodMusicScreen({ navigation }) {
  const [todayMood, setTodayMood] = useState(null);
  const [streak, setStreak] = useState(0);
  const [recommendedSongs, setRecommendedSongs] = useState([]);

  useEffect(() => {
    loadMoodData();
    calculateStreak();
  }, []);

  const loadMoodData = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const parsed = JSON.parse(history);
      const today = new Date().toDateString();
      const todayEntry = parsed.find(m => new Date(m.timestamp).toDateString() === today);
      setTodayMood(todayEntry);
      
      if (todayEntry) {
        const songs = moodSongs[todayEntry.mood] || moodSongs['Happy'];
        setRecommendedSongs(songs);
      }
    }
  };

  const calculateStreak = async () => {
    const history = await AsyncStorage.getItem('moodHistory');
    if (history) {
      const moods = JSON.parse(history);
      let currentStreak = 0;
      const today = new Date().toDateString();
      const hasToday = moods.some(m => new Date(m.timestamp).toDateString() === today);
      
      if (hasToday) {
        currentStreak = 1;
        let checkDate = new Date();
        checkDate.setDate(checkDate.getDate() - 1);
        
        for (let i = 1; i < 30; i++) {
          const dateStr = checkDate.toDateString();
          const hasMood = moods.some(m => new Date(m.timestamp).toDateString() === dateStr);
          if (hasMood) {
            currentStreak++;
            checkDate.setDate(checkDate.getDate() - 1);
          } else {
            break;
          }
        }
      }
      setStreak(currentStreak);
    }
  };

  const openSpotify = async (uri: string) => {
    try {
      const spotifyAppUrl = uri.replace('open.spotify.com', 'spotify');
      const supported = await Linking.canOpenURL(spotifyAppUrl);
      if (supported) {
        await Linking.openURL(spotifyAppUrl);
      } else {
        await WebBrowser.openBrowserAsync(uri);
      }
    } catch (error) {
      await WebBrowser.openBrowserAsync(uri);
    }
  };

  const getMoodEmoji = (mood: string) => {
    const emojis = {
      'Happy': '😊', 'Loved': '🥰', 'Relaxed': '😌',
      'Thoughtful': '🤔', 'Sad': '😢', 'Frustrated': '😤'
    };
    return emojis[mood] || '😊';
  };

  const moods = [
    { label: 'Happy', emoji: '😊', color: '#FFD700' },
    { label: 'Loved', emoji: '🥰', color: '#FF6B9D' },
    { label: 'Relaxed', emoji: '😌', color: '#87CEEB' },
    { label: 'Thoughtful', emoji: '🤔', color: '#DDA0DD' },
    { label: 'Sad', emoji: '😢', color: '#6495ED' },
    { label: 'Frustrated', emoji: '😤', color: '#FF6347' },
  ];

  const saveMood = async (mood) => {
    const moodEntry = {
      mood: mood.label,
      emoji: mood.emoji,
      timestamp: new Date().toISOString(),
    };
    
    const existing = await AsyncStorage.getItem('moodHistory');
    const history = existing ? JSON.parse(existing) : [];
    history.push(moodEntry);
    await AsyncStorage.setItem('moodHistory', JSON.stringify(history));
    
    setTodayMood(moodEntry);
    const songs = moodSongs[mood.label] || moodSongs['Happy'];
    setRecommendedSongs(songs);
    calculateStreak();
  };

  return (
    <ScrollView style={styles.container} showsVerticalScrollIndicator={false}>
      {/* Header with greeting */}
      <View style={styles.header}>
        <Text style={styles.greeting}>Good afternoon 🥰, My Love! 😍</Text>
        <Text style={styles.subGreeting}>You mean the world to me 😍</Text>
      </View>

      {/* Streak Card */}
      <View style={styles.streakCard}>
        <Text style={styles.streakText}>
          {streak} {streak === 1 ? 'day' : 'days'} in a row!
        </Text>
        <Text style={styles.streakSubtext}>Alice is on a streak 🥳</Text>
      </View>

      {/* Mood Selection - Only show if no mood today */}
      {!todayMood ? (
        <View style={styles.moodSection}>
          <Text style={styles.sectionTitle}>How are you feeling today?</Text>
          <View style={styles.moodGrid}>
            {moods.map((mood) => (
              <TouchableOpacity
                key={mood.label}
                style={[styles.moodButton, { backgroundColor: mood.color + '20' }]}
                onPress={() => saveMood(mood)}>
                <Text style={styles.moodEmoji}>{mood.emoji}</Text>
                <Text style={styles.moodLabel}>{mood.label}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>
      ) : (
        <>
          {/* Today's Mood Display */}
          <View style={styles.todayMoodCard}>
            <Text style={styles.todayMoodText}>
              Today's mood: {getMoodEmoji(todayMood.mood)} {todayMood.mood}
            </Text>
            <TouchableOpacity 
              style={styles.updateMoodButton}
              onPress={() => setTodayMood(null)}>
              <Text style={styles.updateMoodText}>Update Mood</Text>
            </TouchableOpacity>
          </View>

          {/* Music Recommendations */}
          {recommendedSongs.length > 0 && (
            <View style={styles.musicSection}>
              <Text style={styles.sectionTitle}>🎵 Songs for your mood</Text>
              {recommendedSongs.map((song, index) => (
                <TouchableOpacity 
                  key={index} 
                  style={styles.songCard}
                  onPress={() => openSpotify(song.uri)}>
                  <Icon name="musical-note" size={24} color="#FF6B9D" />
                  <View style={styles.songInfo}>
                    <Text style={styles.songTitle}>{song.title}</Text>
                    <Text style={styles.songArtist}>{song.artist}</Text>
                  </View>
                  <Icon name="play-circle" size={28} color="#FF6B9D" />
                </TouchableOpacity>
              ))}
            </View>
          )}
        </>
      )}

      {/* Quick Access Section */}
      <View style={styles.quickAccess}>
        <Text style={styles.sectionTitle}>Quick Access 🛠️</Text>
        <View style={styles.quickGrid}>
          <TouchableOpacity 
            style={styles.quickItem}
            onPress={() => router.push('/notes')}>
            <Icon name="document-text" size={28} color="#FF6B9D" />
            <Text style={styles.quickText}>New Note</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickItem}
            onPress={() => router.push('/memories')}>
            <Icon name="images" size={28} color="#FF6B9D" />
            <Text style={styles.quickText}>Memory Jar</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickItem}
            onPress={() => Alert.alert('From Him', 'Thinking of you right now! 💕')}>
            <Icon name="heart" size={28} color="#FF6B9D" />
            <Text style={styles.quickText}>From Him</Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={styles.quickItem}
            onPress={() => openSpotify(OUR_SONG.uri)}>
            <Icon name="musical-notes" size={28} color="#FF6B9D" />
            <Text style={styles.quickText}>Our Playlist</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Footer Quote */}
      <View style={styles.footer}>
        <Text style={styles.footerText}>
          You make ordinary moments extraordinary
        </Text>
        <Text style={styles.footerSubtext}>— With all my heart 🥰</Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FFF5F7',
  },
  header: {
    alignItems: 'center',
    paddingTop: 40,
    paddingBottom: 20,
    backgroundColor: '#fff',
    borderBottomLeftRadius: 30,
    borderBottomRightRadius: 30,
    marginBottom: 20,
  },
  greeting: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
    textAlign: 'center',
  },
  subGreeting: {
    fontSize: 16,
    color: '#888',
    marginTop: 5,
  },
  streakCard: {
    backgroundColor: '#FFE4E9',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
  },
  streakText: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FF6B9D',
  },
  streakSubtext: {
    fontSize: 14,
    color: '#FF6B9D',
    marginTop: 5,
  },
  moodSection: {
    marginHorizontal: 20,
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#FF6B9D',
    marginBottom: 15,
  },
  moodGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
    gap: 10,
  },
  moodButton: {
    width: '30%',
    alignItems: 'center',
    padding: 15,
    borderRadius: 15,
    marginBottom: 10,
  },
  moodEmoji: {
    fontSize: 32,
  },
  moodLabel: {
    marginTop: 8,
    fontSize: 12,
    fontWeight: '500',
  },
  todayMoodCard: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  todayMoodText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
  },
  updateMoodButton: {
    backgroundColor: '#FF6B9D',
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
  },
  updateMoodText: {
    color: '#fff',
    fontSize: 12,
  },
  musicSection: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
  },
  songCard: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F0F0F0',
    gap: 12,
  },
  songInfo: {
    flex: 1,
  },
  songTitle: {
    fontSize: 16,
    fontWeight: '500',
    color: '#333',
  },
  songArtist: {
    fontSize: 12,
    color: '#888',
    marginTop: 2,
  },
  quickAccess: {
    backgroundColor: '#fff',
    marginHorizontal: 20,
    marginBottom: 20,
    padding: 20,
    borderRadius: 20,
  },
  quickGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    justifyContent: 'space-between',
  },
  quickItem: {
    width: '23%',
    alignItems: 'center',
    padding: 10,
    backgroundColor: '#FFF5F7',
    borderRadius: 12,
  },
  quickText: {
    fontSize: 10,
    color: '#FF6B9D',
    marginTop: 5,
    textAlign: 'center',
  },
  footer: {
    marginHorizontal: 20,
    marginBottom: 40,
    padding: 20,
    alignItems: 'center',
  },
  footerText: {
    fontSize: 14,
    fontStyle: 'italic',
    color: '#888',
    textAlign: 'center',
  },
  footerSubtext: {
    fontSize: 12,
    color: '#FF6B9D',
    marginTop: 5,
  },
});
