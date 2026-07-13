// src/app/AudioCallScreen.tsx
// Route '/AudioCallScreen' — audio-only equivalent of VideoCallScreen,
// sharing the exact same useCallSession hook (no duplicated call logic).

import React, { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Image, ActivityIndicator, Animated } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCallSession } from '../hooks/useCallSession';

export default function AudioCallScreen() {
  const params = useLocalSearchParams<{
    callId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserAvatar: string;
    isCaller: string;
    preAccepted?: string;
  }>();

  const otherUserName = params.otherUserName || 'User';
  const otherUserAvatar = params.otherUserAvatar || '';
  const pulseAnim = useRef(new Animated.Value(1)).current;

  const session = useCallSession({
    callId: params.callId,
    otherUserId: params.otherUserId,
    type: 'audio',
    isCaller: params.isCaller === 'true',
    preAccepted: params.preAccepted === 'true',
  });

  useEffect(() => {
    if (session.state !== 'connected') return;
    const loop = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.08, duration: 1200, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 1200, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [session.state, pulseAnim]);

  if (session.state === 'unsupported') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Icon name="construct-outline" size={56} color="#FF6B9D" />
          <Text style={styles.title}>Calling needs a dev build</Text>
          <Text style={styles.subtitle}>LiveKit's native module isn't available here (Expo Go).</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={session.safeBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (session.state === 'failed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <Icon name="alert-circle" size={60} color="#EF4444" />
          <Text style={styles.title}>Call Failed</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={session.safeBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.centered}>
        <Animated.View style={{ transform: [{ scale: session.state === 'connected' ? pulseAnim : 1 }] }}>
          {otherUserAvatar ? (
            <Image source={{ uri: otherUserAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
              <Text style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </Animated.View>
        <Text style={styles.title}>{otherUserName}</Text>
        <Text style={styles.subtitle}>
          {session.state === 'connecting' ? 'Connecting…' : formatDuration(session.duration)}
        </Text>
        {session.state === 'connecting' && <ActivityIndicator size="large" color="#FF6B9D" style={{ marginTop: 12 }} />}
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={session.toggleMute}>
          <Icon name={session.isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={session.toggleSpeaker}>
          <Icon name={session.isSpeakerOn ? 'volume-high' : 'volume-low'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={[styles.controlButton, styles.endCall]} onPress={session.endCall}>
          <Icon name="call" size={30} color="#fff" style={styles.declineIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  avatar: { width: 160, height: 160, borderRadius: 80, marginBottom: 20 },
  avatarFallback: { width: 160, height: 160, borderRadius: 80, alignItems: 'center', justifyContent: 'center', marginBottom: 20 },
  avatarText: { fontSize: 56, fontWeight: '700', color: '#fff' },
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#999', textAlign: 'center' },
  primaryButton: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#FF6B9D', borderRadius: 25, marginTop: 16 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  controls: { position: 'absolute', bottom: 60, left: 0, right: 0, flexDirection: 'row', justifyContent: 'center', gap: 20 },
  controlButton: { width: 58, height: 58, borderRadius: 29, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  endCall: { backgroundColor: '#EF4444', width: 66, height: 66, borderRadius: 33 },
  declineIcon: { transform: [{ rotate: '135deg' }] },
});
