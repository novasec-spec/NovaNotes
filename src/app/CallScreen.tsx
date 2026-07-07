// src/app/CallScreen.tsx
//
// ⚠️ PLACEMENT MATTERS FOR THE SITEMAP:
// This file must live at the exact path Expo Router scans as your routes
// root (commonly `src/app/CallScreen.tsx` for a flat structure, or
// `src/app/call/CallScreen.tsx` if you use a `call/` group — pick ONE and
// make sure every `router.push()` in NotificationHandler.ts /
// IncomingCallScreen.tsx points at the matching path). It must keep this
// exact default export, and no `_layout.tsx` above it may scope routes via
// an explicit <Stack.Screen> allowlist that omits "CallScreen".
//
// ⚠️ RUNTIME SAFETY:
// LiveKit's native WebRTC module does not exist inside Expo Go — only in a
// dev-client / EAS build. Rather than crash the whole route (which is what
// was making it look "missing"), this file detects that case up front and
// renders a clear fallback screen instead. Once you run a dev-client build,
// `canUseLiveKit` flips to true automatically and the real call UI renders.

import React, { useCallback, useEffect, useRef, useState } from 'react';
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
} from 'react-native';
import Constants from 'expo-constants';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { Track, RemoteParticipant, RemoteTrack, RemoteTrackPublication } from 'livekit-client';
import CallService from '../services/CallService';

const { width } = Dimensions.get('window');
const RING_TIMEOUT_SECONDS = 45;

// `storeClient` = running inside the Expo Go app, where custom native
// modules (like @livekit/react-native-webrtc) can never be present.
const isExpoGo = Constants.executionEnvironment === Constants.ExecutionEnvironment?.StoreClient;

// Lazily/safely pull in the native video component. If this throws (module
// truly missing) we fall back gracefully instead of taking the route down.
let VideoView: any = null;
let canUseLiveKit = !isExpoGo;
if (canUseLiveKit) {
  try {
    VideoView = require('@livekit/react-native').VideoView;
  } catch (e) {
    console.warn('⚠️ @livekit/react-native native module unavailable:', e);
    canUseLiveKit = false;
  }
}

type CallState = 'connecting' | 'ringing' | 'connected' | 'ended' | 'failed' | 'unsupported';

export default function CallScreen() {
  const params = useLocalSearchParams<{
    callId: string;
    calleeId: string;
    calleeName: string;
    calleeAvatar: string;
    type: 'audio' | 'video';
    isCaller: string;
    preAccepted?: string;
  }>();

  const [callState, setCallState] = useState<CallState>(canUseLiveKit ? 'connecting' : 'unsupported');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(params.type !== 'audio');
  const [isSpeakerOn, setIsSpeakerOn] = useState(params.type !== 'audio');
  const [remoteVideoTrack, setRemoteVideoTrack] = useState<any>(null);
  const [localVideoTrack, setLocalVideoTrack] = useState<any>(null);
  const [remoteJoined, setRemoteJoined] = useState(false);

  const durationInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const hasEndedRef = useRef(false);
  const unsubscribeCallRef = useRef<(() => void) | null>(null);
  const unsubscribeRoomRef = useRef<(() => void) | null>(null);

  const calleeName = params.calleeName || 'User';
  const calleeAvatar = params.calleeAvatar || '';
  const isCaller = params.isCaller === 'true';
  const isVideo = params.type !== 'audio';

  useEffect(() => {
    if (!canUseLiveKit) return; // fallback UI already showing, nothing to wire up

    // Guard against the "undefined" UUID error: if we got here without a
    // callId, the navigation params didn't arrive (route path mismatch is
    // the usual cause) — fail loudly instead of hitting Supabase with junk.
    if (!params.callId) {
      console.warn('⚠️ CallScreen mounted with no callId param — check router.push() path matches this route.');
      setCallState('failed');
      return;
    }

    initializeCall();
    return () => teardown();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.callId]);

  const initializeCall = async () => {
    try {
      if (params.preAccepted === 'true') {
        const tokenData = await CallService.acceptCall(params.callId);
        if (tokenData) await joinCall();
        else setCallState('failed');
        return;
      }

      if (isCaller) {
        setCallState('ringing');
        watchForAcceptance();
      } else {
        const tokenData = await CallService.acceptCall(params.callId);
        if (tokenData) await joinCall();
        else setCallState('failed');
      }
    } catch (error) {
      console.error('Call init error:', error);
      setCallState('failed');
    }
  };

  const watchForAcceptance = () => {
    let timedOut = false;
    const timeout = setTimeout(() => {
      timedOut = true;
      if (!hasEndedRef.current) {
        CallService.cancelCall(params.callId);
        setCallState('ended');
        safeBack();
      }
    }, RING_TIMEOUT_SECONDS * 1000);

    unsubscribeCallRef.current = CallService.subscribeToCall(params.callId, async (call) => {
      if (timedOut || hasEndedRef.current) return;

      if (call.status === 'connected') {
        clearTimeout(timeout);
        const tokenData = await CallService.acceptCall(params.callId);
        if (tokenData) await joinCall();
        else setCallState('failed');
        return;
      }

      if (['declined', 'ended', 'cancelled'].includes(call.status)) {
        clearTimeout(timeout);
        hasEndedRef.current = true;
        setCallState('ended');
        safeBack();
      }
    });
  };

  const joinCall = async () => {
    try {
      const tokenResult = await CallService.getLiveKitToken(params.callId, params.calleeId || '');
      if (!tokenResult) {
        setCallState('failed');
        return;
      }

      const success = await CallService.joinRoom(tokenResult.token, tokenResult.url, isVideo ? 'video' : 'audio');
      if (!success) {
        setCallState('failed');
        return;
      }

      setCallState('connected');
      startTimer();
      attachLocalTrack();

      unsubscribeRoomRef.current = CallService.onRoomEvents({
        onParticipantConnected: () => setRemoteJoined(true),
        onTrackSubscribed: (track: RemoteTrack, _pub: RemoteTrackPublication, _participant: RemoteParticipant) => {
          if (track.kind === Track.Kind.Video) setRemoteVideoTrack(track);
        },
        onTrackUnsubscribed: (track: RemoteTrack) => {
          if (track.kind === Track.Kind.Video) setRemoteVideoTrack(null);
        },
        onParticipantDisconnected: () => {
          setRemoteJoined(false);
          setRemoteVideoTrack(null);
        },
        onDisconnected: () => {
          if (!hasEndedRef.current) endCall();
        },
      });

      unsubscribeCallRef.current = CallService.subscribeToCall(params.callId, (call) => {
        if (hasEndedRef.current) return;
        if (['ended', 'declined'].includes(call.status)) endCall();
      });
    } catch (error) {
      console.error('Join call error:', error);
      setCallState('failed');
    }
  };

  const attachLocalTrack = () => {
    const room = CallService.getRoom();
    const pub = room?.localParticipant.getTrackPublication(Track.Source.Camera);
    if (pub?.videoTrack) setLocalVideoTrack(pub.videoTrack);
  };

  const startTimer = () => {
    durationInterval.current = setInterval(() => setCallDuration((prev) => prev + 1), 1000);
  };

  const safeBack = () => {
    if (router.canGoBack()) router.back();
  };

  const endCall = useCallback(async () => {
    if (hasEndedRef.current) return;
    hasEndedRef.current = true;
    if (durationInterval.current) clearInterval(durationInterval.current);
    await CallService.leaveRoom();
    await CallService.endCall(params.callId || '');
    setCallState('ended');
    safeBack();
  }, [params.callId]);

  const teardown = () => {
    if (durationInterval.current) clearInterval(durationInterval.current);
    unsubscribeCallRef.current?.();
    unsubscribeRoomRef.current?.();
    if (!hasEndedRef.current) {
      hasEndedRef.current = true;
      CallService.leaveRoom();
      CallService.endCall(params.callId || '');
    }
  };

  const toggleMute = async () => setIsMuted(await CallService.toggleMute());
  const toggleCamera = async () => setIsCameraOn(await CallService.toggleCamera());
  const toggleSpeaker = () => {
    const next = !isSpeakerOn;
    setIsSpeakerOn(next);
    CallService.toggleSpeaker(next);
  };
  const flipCamera = () => CallService.switchCamera();

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render: unsupported (Expo Go / no native module) ───────────────────
  if (callState === 'unsupported') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.failedContainer}>
          <Icon name="construct-outline" size={56} color="#FF6B9D" />
          <Text style={styles.failedTitle}>Calling needs a dev build</Text>
          <Text style={styles.failedText}>
            This route loaded fine — LiveKit's native module just isn't available in Expo Go. Run{' '}
            <Text style={{ fontWeight: '700' }}>npx expo run:ios</Text> (or run:android), or install an EAS
            dev-client build, then try again.
          </Text>
          <TouchableOpacity style={styles.tryAgainButton} onPress={safeBack}>
            <Text style={styles.tryAgainText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: connecting / ringing ────────────────────────────────────────
  if (callState === 'connecting' || callState === 'ringing') {
    return (
      <SafeAreaView style={styles.container}>
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
          <Text style={styles.connectingText}>{isCaller ? 'Ringing…' : 'Connecting…'}</Text>
          <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
          <TouchableOpacity
            style={styles.endCallButton}
            onPress={() => (isCaller ? CallService.cancelCall(params.callId).then(safeBack) : endCall())}
          >
            <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: connected ────────────────────────────────────────────────────
  if (callState === 'connected') {
    return (
      <SafeAreaView style={styles.container}>
        <StatusBar barStyle="light-content" />

        {isVideo && remoteVideoTrack && VideoView ? (
          <VideoView style={styles.remoteVideo} videoTrack={remoteVideoTrack} objectFit="cover" mirror={false} />
        ) : (
          <View style={[styles.remoteVideo, styles.audioOnlyBackdrop]}>
            {calleeAvatar ? (
              <Image source={{ uri: calleeAvatar }} style={styles.avatarLarge} />
            ) : (
              <View style={[styles.avatarFallbackLarge, { backgroundColor: '#FF6B9D' }]}>
                <Text style={styles.avatarText}>{calleeName.charAt(0).toUpperCase()}</Text>
              </View>
            )}
            {!remoteJoined && <Text style={styles.connectingText}>Waiting for {calleeName}…</Text>}
          </View>
        )}

        {isVideo && isCameraOn && localVideoTrack && VideoView && (
          <VideoView style={styles.localVideo} videoTrack={localVideoTrack} objectFit="cover" mirror />
        )}

        <View style={styles.callInfo}>
          <Text style={styles.calleeName}>{calleeName}</Text>
          <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
        </View>

        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
            <Icon name={isMuted ? 'mic-off' : 'mic'} size={26} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
            <Icon name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={26} color="#fff" />
          </TouchableOpacity>

          {isVideo && (
            <>
              <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
                <Icon name={isCameraOn ? 'videocam' : 'videocam-off'} size={26} color="#fff" />
              </TouchableOpacity>
              <TouchableOpacity style={styles.controlButton} onPress={flipCamera}>
                <Icon name="camera-reverse" size={26} color="#fff" />
              </TouchableOpacity>
            </>
          )}

          <TouchableOpacity style={[styles.controlButton, styles.endCall]} onPress={endCall}>
            <Icon name="call" size={30} color="#fff" style={styles.declineIcon} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  // ─── Render: failed ───────────────────────────────────────────────────────
  if (callState === 'failed') {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.failedContainer}>
          <Icon name="alert-circle" size={60} color="#EF4444" />
          <Text style={styles.failedTitle}>Call Failed</Text>
          <Text style={styles.failedText}>
            {!params.callId ? 'No call ID was passed to this screen.' : 'Could not establish connection.'}
          </Text>
          <TouchableOpacity style={styles.tryAgainButton} onPress={safeBack}>
            <Text style={styles.tryAgainText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  connectingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  avatarContainer: { marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarLarge: { width: 140, height: 140, borderRadius: 70 },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  avatarFallbackLarge: { width: 140, height: 140, borderRadius: 70, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 48, fontWeight: '700', color: '#fff' },
  calleeName: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  connectingText: { fontSize: 16, color: '#999', marginTop: 16, marginBottom: 32 },
  loader: { marginBottom: 40 },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  declineIcon: { transform: [{ rotate: '135deg' }] },
  remoteVideo: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0 },
  audioOnlyBackdrop: { alignItems: 'center', justifyContent: 'center', backgroundColor: '#16162a' },
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
  callDuration: { fontSize: 16, color: '#fff', marginTop: 4 },
  controls: {
    position: 'absolute',
    bottom: 50,
    left: 0,
    right: 0,
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 18,
    paddingHorizontal: 20,
  },
  controlButton: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: 'rgba(255,255,255,0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  endCall: { backgroundColor: '#EF4444', width: 62, height: 62, borderRadius: 31 },
  failedContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  failedTitle: { fontSize: 24, fontWeight: '700', color: '#fff', marginTop: 16 },
  failedText: { fontSize: 15, color: '#999', marginTop: 8, marginBottom: 32, textAlign: 'center', lineHeight: 21 },
  tryAgainButton: { paddingHorizontal: 32, paddingVertical: 14, backgroundColor: '#FF6B9D', borderRadius: 25 },
  tryAgainText: { fontSize: 16, fontWeight: '600', color: '#fff' },
});
