// src/app/VideoCallScreen.tsx
// Route '/VideoCallScreen' — always reached with an already-'connected' call
// (either via CallingScreen after the callee accepted, or directly from
// IncomingCallScreen/notification for the callee).

import React from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Image, ActivityIndicator } from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useCallSession } from '../hooks/useCallSession';
import { getVideoView } from '../lib/callAvailability';

export default function VideoCallScreen() {
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
  const VideoView = getVideoView();

  const session = useCallSession({
    callId: params.callId,
    otherUserId: params.otherUserId,
    type: 'video',
    isCaller: params.isCaller === 'true',
    preAccepted: params.preAccepted === 'true',
  });

  if (session.state === 'unsupported') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centered}>
          <Icon name="construct-outline" size={56} color="#FF6B9D" />
          <Text style={styles.title}>Calling needs a dev build</Text>
          <Text style={styles.subtitle}>
            LiveKit's native module isn't available here (Expo Go). Run a dev-client or production build to test calling.
          </Text>
          <TouchableOpacity style={styles.primaryButton} onPress={session.safeBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (session.state === 'connecting') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B9D" />
          <Text style={styles.subtitle}>Connecting…</Text>
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
          <Text style={styles.subtitle}>{!params.callId ? 'No call ID was passed to this screen.' : 'Could not establish connection.'}</Text>
          <TouchableOpacity style={styles.primaryButton} onPress={session.safeBack}>
            <Text style={styles.primaryButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // connected
  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />

      {session.remoteVideoTrack && VideoView ? (
        <VideoView style={styles.remoteVideo} videoTrack={session.remoteVideoTrack} objectFit="cover" mirror={false} />
      ) : (
        <View style={[styles.remoteVideo, styles.audioBackdrop]}>
          {otherUserAvatar ? (
            <Image source={{ uri: otherUserAvatar }} style={styles.avatarLarge} />
          ) : (
            <View style={[styles.avatarFallbackLarge, { backgroundColor: '#FF6B9D' }]}>
              <Text style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
          {!session.remoteJoined && <Text style={styles.subtitle}>Waiting for {otherUserName}…</Text>}
        </View>
      )}

      {session.isCameraOn && session.localVideoTrack && VideoView && (
        <VideoView style={styles.localVideo} videoTrack={session.localVideoTrack} objectFit="cover" mirror />
      )}

      <View style={styles.callInfo}>
        <Text style={styles.title}>{otherUserName}</Text>
        <Text style={styles.duration}>{formatDuration(session.duration)}</Text>
      </View>

      <View style={styles.controls}>
        <TouchableOpacity style={styles.controlButton} onPress={session.toggleMute}>
          <Icon name={session.isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={session.toggleSpeaker}>
          <Icon name={session.isSpeakerOn ? 'volume-high' : 'volume-low'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={session.toggleCamera}>
          <Icon name={session.isCameraOn ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity style={styles.controlButton} onPress={session.flipCamera}>
          <Icon name="camera-reverse" size={26} color="#fff" />
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
  title: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 16, marginBottom: 8 },
  subtitle: { fontSize: 15, color: '#999', textAlign: 'center', lineHeight: 21, marginBottom: 24 },
  primaryButton: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#FF6B9D', borderRadius: 25 },
  primaryButtonText: { fontSize: 16, fontWeight: '600', color: '#fff' },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  audioBackdrop: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#16162a' },
  avatarLarge: { width: 140, height: 140, borderRadius: 70 },
  avatarFallbackLarge: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 48, fontWeight: '700', color: '#fff' },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 110,
    height: 150,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
    overflow: 'hidden',
  },
  callInfo: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  duration: { fontSize: 16, color: '#fff', marginTop: 4 },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 16,
    paddingHorizontal: 20,
  },
  controlButton: { width: 54, height: 54, borderRadius: 27, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' },
  endCall: { backgroundColor: '#EF4444', width: 62, height: 62, borderRadius: 31 },
  declineIcon: { transform: [{ rotate: '135deg' }] },
});
