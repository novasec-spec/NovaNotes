// src/app/(tabs)/chat/CallScreen.tsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  SafeAreaView,
  StatusBar,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { Ionicons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import CallService from '../../../services/CallService';
import {
  LiveKitRoom,
  AudioSession,
  useTracks,
  useLocalParticipant,
  useRoomContext,
  VideoTrack,
  isTrackReference,
} from '@livekit/react-native';
import { Track, RoomEvent, ConnectionState } from 'livekit-client';

export default function CallScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    callId: string;
    calleeId: string;
    calleeName: string;
    calleeAvatar: string;
    type: 'audio' | 'video';
    isCaller: string;
  }>();

  const [tokenData, setTokenData] = useState<{ token: string; url: string } | null>(null);
  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended' | 'failed'>('connecting');

  const calleeName = params.calleeName || 'User';
  const calleeAvatar = params.calleeAvatar || '';
  const isCaller = params.isCaller === 'true';
  const unsubscribeStatus = useRef<(() => void) | null>(null);

  // ─── Audio session (required before connecting on native) ──────────────
  useEffect(() => {
    AudioSession.startAudioSession();
    return () => {
      AudioSession.stopAudioSession();
    };
  }, []);

  // ─── Acquire a LiveKit token, then wait for callee acceptance if caller ─
  useEffect(() => {
    initializeCall();
    unsubscribeStatus.current = CallService.subscribeToCallStatus(params.callId, (status) => {
      if (status === 'declined' || status === 'ended' || status === 'missed') {
        setCallState('ended');
        router.back();
      }
    });

    return () => {
      unsubscribeStatus.current?.();
    };
  }, []);

  const initializeCall = async () => {
    try {
      if (isCaller) {
        // Poll for acceptance, then join once the callee has accepted.
        // subscribeToCallStatus above handles decline/end; this handles accept.
        const stopPolling = CallService.pollCallStatus(params.callId, async (status) => {
          if (status === 'connected') {
            await joinAsUser();
          }
        });
        return () => stopPolling();
      } else {
        // Callee already accepted via IncomingCallScreen — join immediately.
        await joinAsUser();
      }
    } catch (error) {
      console.error('Call init error:', error);
      setCallState('failed');
    }
  };

  const joinAsUser = async () => {
    const data = await CallService.getLiveKitToken(params.callId, params.calleeId || '');
    if (!data) {
      setCallState('failed');
      return;
    }
    setTokenData(data);
  };

  const endCall = async () => {
    if (unsubscribeStatus.current) unsubscribeStatus.current();
    await CallService.endCall(params.callId || '');
    setCallState('ended');
    router.back();
  };

  // ─── Connecting / Failed states (no room yet) ───────────────────────────
  if (callState === 'connecting' && !tokenData) {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1A1A2E' }]}>
        <StatusBar barStyle="light-content" />
        <View style={styles.connectingContainer}>
          <View style={styles.avatarContainer}>
            {calleeAvatar ? (
              <Image source={{ uri: calleeAvatar }} style={styles.avatar} />
            ) : (
              <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
                <Text style={styles.avatarText}>{calleeName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
          </View>
          <Text style={styles.calleeName}>{calleeName}</Text>
          <Text style={styles.connectingText}>{isCaller ? 'Ringing...' : 'Connecting...'}</Text>
          <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
          <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
            <Icon name="call" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (callState === 'failed') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1A1A2E' }]}>
        <View style={styles.failedContainer}>
          <Icon name="alert-circle" size={60} color="#EF4444" />
          <Text style={styles.failedTitle}>Call Failed</Text>
          <Text style={styles.failedText}>Could not establish connection</Text>
          <TouchableOpacity style={styles.tryAgainButton} onPress={() => router.back()}>
            <Text style={styles.tryAgainText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (!tokenData) return null;

  // ─── Connected: wrap the actual call UI in LiveKitRoom ─────────────────
  return (
    <LiveKitRoom
      serverUrl={tokenData.url}
      token={tokenData.token}
      connect={true}
      audio={true}
      video={params.type === 'video'}
      options={{ adaptiveStream: { pixelDensity: 'screen' } }}
      onDisconnected={() => {
        if (callState !== 'ended') {
          setCallState('ended');
          router.back();
        }
      }}
      onError={(error) => {
        console.error('LiveKit room error:', error);
        Alert.alert('Call error', 'Connection was interrupted.');
      }}
    >
      <CallRoomUI
        calleeName={calleeName}
        callType={params.type}
        onEndCall={endCall}
      />
    </LiveKitRoom>
  );
}

// ─── In-call UI (rendered inside LiveKitRoom, has access to room context) ─
function CallRoomUI({
  calleeName,
  callType,
  onEndCall,
}: {
  calleeName: string;
  callType: 'audio' | 'video';
  onEndCall: () => void;
}) {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const tracks = useTracks([Track.Source.Camera]);
  const [duration, setDuration] = useState(0);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    durationInterval.current = setInterval(() => setDuration((d) => d + 1), 1000);
    return () => {
      if (durationInterval.current) clearInterval(durationInterval.current);
    };
  }, []);

  const remoteTrack = tracks.find(
    (t) => t.participant.identity !== localParticipant.identity && isTrackReference(t)
  );
  const localTrack = tracks.find(
    (t) => t.participant.identity === localParticipant.identity && isTrackReference(t)
  );

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#1A1A2E' }]}>
      <StatusBar barStyle="light-content" />

      {/* Remote Video (full screen) */}
      {remoteTrack && isTrackReference(remoteTrack) ? (
        <VideoTrack trackRef={remoteTrack} style={styles.remoteVideo} objectFit="cover" />
      ) : (
        <View style={styles.noVideoContainer}>
          <Icon name="person" size={60} color="#fff" />
          <Text style={styles.noVideoText}>{calleeName}</Text>
        </View>
      )}

      {/* Local Video (PIP) */}
      {localTrack && isTrackReference(localTrack) && isCameraEnabled && (
        <View style={styles.localVideoContainer}>
          <VideoTrack trackRef={localTrack} style={styles.localVideo} objectFit="cover" mirror />
        </View>
      )}

      {/* Callee Name & Duration */}
      <View style={styles.callInfo}>
        <Text style={styles.calleeName}>{calleeName}</Text>
        <Text style={styles.callDuration}>{formatDuration(duration)}</Text>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <TouchableOpacity
          style={styles.controlButton}
          onPress={() => localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled)}
        >
          <Icon name={isMicrophoneEnabled ? 'mic' : 'mic-off'} size={28} color="#fff" />
        </TouchableOpacity>

        <TouchableOpacity style={styles.controlButton} onPress={() => setIsSpeakerOn(!isSpeakerOn)}>
          <Icon name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={28} color="#fff" />
        </TouchableOpacity>

        {callType === 'video' && (
          <TouchableOpacity
            style={styles.controlButton}
            onPress={() => localParticipant.setCameraEnabled(!isCameraEnabled)}
          >
            <Icon name={isCameraEnabled ? 'camera' : 'camera-reverse'} size={28} color="#fff" />
          </TouchableOpacity>
        )}

        <TouchableOpacity style={[styles.controlButton, styles.endCall]} onPress={onEndCall}>
          <Icon name="call" size={32} color="#fff" />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  connectingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  avatarContainer: { marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 48, fontWeight: '700', color: '#fff' },
  calleeName: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  connectingText: { fontSize: 16, color: '#999', marginBottom: 32 },
  loader: { marginBottom: 40 },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  noVideoContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  noVideoText: { color: '#fff', fontSize: 18, marginTop: 10 },
  localVideoContainer: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: '#fff',
  },
  localVideo: { width: 120, height: 160 },
  callInfo: { position: 'absolute', top: 60, left: 0, right: 0, alignItems: 'center' },
  callDuration: { fontSize: 16, color: '#fff', marginTop: 4 },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCall: { backgroundColor: '#EF4444', width: 64, height: 64, borderRadius: 32 },
  failedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  failedTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 16 },
  failedText: { fontSize: 16, color: '#999', marginTop: 8, marginBottom: 32 },
  tryAgainButton: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#FF6B9D', borderRadius: 25 },
  tryAgainText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
