// src/app/mood-checkin.tsx

import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Alert,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { router, useLocalSearchParams } from 'expo-router';
import { useTheme } from '../contexts/ThemeContext';
import { useMoodNotifications } from '../hooks/useMoodNotifications';
import MoodTracker from '../components/MoodTracker';

export default function MoodCheckinScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const params = useLocalSearchParams();
  const { handleMoodFromNotification } = useMoodNotifications();
  
  const [checkinType, setCheckinType] = useState<'followup' | 'morning' | 'evening' | 'random'>(
    (params.type as any) || 'followup'
  );
  const [previousMood, setPreviousMood] = useState<any>(null);

  useEffect(() => {
    // Load previous mood if it's a followup
    if (params.previousMood) {
      try {
        setPreviousMood(JSON.parse(params.previousMood as string));
      } catch {}
    }
  }, []);

  const handleMoodSelect = async (mood: any) => {
    // Save with notification context
    const entry = await handleMoodFromNotification(mood, undefined, checkinType);
    
    if (entry) {
      Alert.alert(
        '💕 Mood Saved!',
        `Thank you for sharing. You're feeling ${mood.label}.`,
        [
          { 
            text: 'OK', 
            onPress: () => router.back() 
          }
        ]
      );
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background, paddingTop: insets.top }]}>
      {/* Header */}
      <View style={[styles.header, { borderBottomColor: colors.border }]}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backButton}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]}>
          {checkinType === 'followup' ? 'Checking in 💕' : 
           checkinType === 'morning' ? 'Good Morning 🌅' :
           checkinType === 'evening' ? 'Evening Reflection 🌙' :
           'How are you feeling? 💭'}
        </Text>
        <View style={{ width: 40 }} />
      </View>

      {/* Context Message */}
      {previousMood && (
        <View style={[styles.contextCard, { backgroundColor: colors.card }]}>
          <Text style={[styles.contextEmoji, { color: previousMood.color }]}>
            {previousMood.icon}
          </Text>
          <Text style={[styles.contextText, { color: colors.text }]}>
            Earlier you felt <Text style={{ color: previousMood.color }}>
              {previousMood.label}
            </Text>
          </Text>
          <Text style={[styles.contextSub, { color: colors.muted }]}>
            How are you feeling now?
          </Text>
        </View>
      )}

      {/* Mood Tracker */}
      <MoodTracker 
        onMoodSelect={handleMoodSelect}
        size="large"
        showCommentInput={true}
        notificationContext={checkinType}
      />

      {/* Footer */}
      <Text style={[styles.footer, { color: colors.muted }]}>
        Your feelings matter. Thank you for sharing. 💕
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
  },
  backButton: {
    padding: 4,
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: '700',
  },
  contextCard: {
    margin: 16,
    padding: 16,
    borderRadius: 16,
    alignItems: 'center',
    elevation: 2,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
  },
  contextEmoji: {
    fontSize: 32,
    marginBottom: 8,
  },
  contextText: {
    fontSize: 16,
    fontWeight: '600',
    textAlign: 'center',
  },
  contextSub: {
    fontSize: 14,
    marginTop: 4,
    textAlign: 'center',
  },
  footer: {
    textAlign: 'center',
    fontSize: 14,
    paddingVertical: 20,
  },
});
