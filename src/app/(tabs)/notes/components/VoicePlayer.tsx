// components/VoicePlayer.tsx
import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';
import { VoiceNote } from '../types';
import { formatDuration } from '../utils/helpers';

interface VoicePlayerProps {
  voiceNote: VoiceNote;
  themeAccent: string;
  colors: any;
}

export function VoicePlayer({ voiceNote, themeAccent, colors }: VoicePlayerProps) {
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  useEffect(() => {
    return () => {
      if (sound) sound.unloadAsync();
    };
  }, [sound]);

  const playVoice = async () => {
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: voiceNote.uri },
      { shouldPlay: true }
    );
    setSound(newSound);
    setIsPlaying(true);

    newSound.setOnPlaybackStatusUpdate((status) => {
      if (status.isLoaded && status.didJustFinish) {
        setIsPlaying(false);
        newSound.unloadAsync();
        setSound(null);
      }
    });
  };

  const pauseVoice = async () => {
    if (sound) {
      await sound.pauseAsync();
      setIsPlaying(false);
    }
  };

  return (
    <TouchableOpacity
      style={[styles.container, { backgroundColor: colors.card + '88' }]}
      onPress={isPlaying ? pauseVoice : playVoice}
      activeOpacity={0.8}>
      <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={32} color={themeAccent} />
      <View style={styles.info}>
        <Text style={[styles.duration, { color: colors.text }]}>{formatDuration(voiceNote.duration)}</Text>
        <Text style={[styles.date, { color: colors.text }]}>
          {new Date(voiceNote.timestamp).toLocaleTimeString()}
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  container: { flexDirection: 'row', alignItems: 'center', gap: 12, padding: 8, borderRadius: 12, marginVertical: 4 },
  info: { flex: 1 },
  duration: { fontSize: 14, fontWeight: '600' },
  date: { fontSize: 10 },
});
