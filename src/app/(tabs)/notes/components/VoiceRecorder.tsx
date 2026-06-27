// components/VoiceRecorder.tsx
import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';
import { VoiceNote } from '../types';
import { formatDuration } from '../utils/helpers';
import { WHITE, DANGER } from '../utils/constants';

interface VoiceRecorderProps {
  onSave: (voiceNote: VoiceNote) => void;
  onCancel: () => void;
  themeAccent: string;
  colors: any;
}

export function VoiceRecorder({ onSave, onCancel, themeAccent, colors }: VoiceRecorderProps) {
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [duration, setDuration] = useState(0);
  const [sound, setSound] = useState<Audio.Sound | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);
  const [recordedUri, setRecordedUri] = useState<string | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    Audio.requestPermissionsAsync();
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
      if (sound) sound.unloadAsync();
    };
  }, []);

  const startRecording = async () => {
    try {
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY
      );
      setRecording(recording);
      setIsRecording(true);
      setDuration(0);
      setRecordedUri(null);

      timerRef.current = setInterval(() => {
        setDuration(prev => prev + 1);
      }, 1000);
    } catch (err) {
      console.error('Failed to start recording', err);
      Alert.alert('Error', 'Could not start recording');
    }
  };

  const stopRecording = async () => {
    if (!recording) return;
    if (timerRef.current) clearInterval(timerRef.current);
    setIsRecording(false);
    await recording.stopAndUnloadAsync();
    const uri = recording.getURI();
    setRecordedUri(uri);
    setRecording(null);
  };

  const confirmSave = () => {
    if (!recordedUri) return;
    onSave({
      uri: recordedUri,
      duration,
      timestamp: new Date().toISOString(),
    });
  };

  const playRecording = async () => {
    if (!recordedUri) return;
    if (sound) {
      await sound.unloadAsync();
      setSound(null);
      setIsPlaying(false);
    }

    const { sound: newSound } = await Audio.Sound.createAsync(
      { uri: recordedUri },
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

  return (
    <View style={[styles.container, { backgroundColor: colors.card }]}>
      <View style={styles.header}>
        <View style={styles.titleRow}>
          <Icon name="mic" size={18} color={themeAccent} />
          <Text style={[styles.title, { color: themeAccent }]}>Voice Note</Text>
        </View>
        <TouchableOpacity onPress={onCancel}>
          <Icon name="close" size={24} color={colors.text} />
        </TouchableOpacity>
      </View>

      <View style={styles.controls}>
        {isRecording ? (
          <TouchableOpacity style={[styles.recordBtn, { backgroundColor: DANGER }]} onPress={stopRecording}>
            <Icon name="stop" size={28} color={WHITE} />
            <Text style={styles.recordBtnText}>Stop</Text>
          </TouchableOpacity>
        ) : recordedUri ? (
          <>
            <TouchableOpacity style={styles.playBtn} onPress={playRecording}>
              <Icon name={isPlaying ? 'pause-circle' : 'play-circle'} size={36} color={themeAccent} />
              <Text style={[styles.duration, { color: colors.text }]}>{formatDuration(duration)}</Text>
            </TouchableOpacity>
            <View style={styles.actionsRow}>
              <TouchableOpacity style={[styles.secondaryBtn, { borderColor: colors.border }]} onPress={() => { setRecordedUri(null); setDuration(0); }}>
                <Icon name="refresh" size={16} color={colors.text} />
                <Text style={[styles.secondaryBtnText, { color: colors.text }]}>Re-record</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.recordBtn, { backgroundColor: themeAccent, paddingHorizontal: 18 }]} onPress={confirmSave}>
                <Icon name="checkmark" size={20} color={WHITE} />
                <Text style={styles.recordBtnText}>Use</Text>
              </TouchableOpacity>
            </View>
          </>
        ) : (
          <TouchableOpacity style={[styles.recordBtn, { backgroundColor: themeAccent }]} onPress={startRecording}>
            <Icon name="mic" size={28} color={WHITE} />
            <Text style={styles.recordBtnText}>Start Recording</Text>
          </TouchableOpacity>
        )}

        {isRecording && (
          <Text style={[styles.timer, { color: colors.text }]}>
            Recording... {formatDuration(duration)}
          </Text>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { borderRadius: 28, padding: 24, width: '90%' },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  titleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  title: { fontSize: 18, fontWeight: '800' },
  controls: { alignItems: 'center', gap: 16 },
  actionsRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  secondaryBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 16, paddingVertical: 12, borderRadius: 40, borderWidth: 1.5 },
  secondaryBtnText: { fontSize: 14, fontWeight: '700' },
  recordBtn: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 24, paddingVertical: 14, borderRadius: 40 },
  recordBtnText: { color: WHITE, fontSize: 16, fontWeight: '700' },
  playBtn: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  duration: { fontSize: 14 },
  timer: { fontSize: 14 },
});
