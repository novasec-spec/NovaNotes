// src/app/IncomingCallScreen.tsx
// Confirmed flat location: src/app/IncomingCallScreen.tsx → route '/IncomingCallScreen'

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Image, Animated, Dimensions, Vibration } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio'; // NOT expo-av — confirmed package
import CallService from '../services/CallService';

const { width } = Dimensions.get('window');
const RING_TIMEOUT_SECONDS = 30;
const VIBRATION_PATTERN = [0, 500, 500];

export default function IncomingCallScreen() {
  const params = useLocalSearchParams<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    type: 'audio' | 'video';
  }>();

  const [callerInfo, setCallerInfo] = useState<{ username: string; avatar_url?: string } | null>(null);
  const [secondsLeft, setSecondsLeft] = useState(RING_TIMEOUT_SECONDS);

  const resolvedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringtoneRef = useRef<AudioPlayer | null>(null);

  const callerName = params.callerName || callerInfo?.username || 'Unknown';
  const callerAvatar = params.callerAvatar || callerInfo?.avatar_url || '';

  useEffect(() => {
    if (params.callerName) return;
    CallService.getOtherUser(params.callId).then((user) => {
      if (user) setCallerInfo({ username: user.username, avatar_url: user.avatar_url });
    });
  }, [params.callId]);

  // Realtime: caller cancels before we answer → leave automatically
  useEffect(() => {
    const unsubscribe = CallService.subscribeToCall(params.callId, (call) => {
      if (resolvedRef.current) return;
      if (['cancelled', 'ended', 'missed'].includes(call.status)) {
        resolvedRef.current = true;
        cleanupAndLeave();
      }
    });
    return unsubscribe;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.callId]);

  // Ringtone + vibration + pulse
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await setAudioModeAsync({ playsInSilentMode: true });
        const player = createAudioPlayer(require('../../assets/sounds/ringtone.mp3')); // add this asset
        player.loop = true;
        player.volume = 1.0;
        if (isMounted) {
          ringtoneRef.current = player;
          player.play();
        } else {
          player.release();
        }
      } catch (error) {
        console.warn('⚠️ Ringtone unavailable (vibration still works):', error);
      }
    })();

    Vibration.vibrate(VIBRATION_PATTERN, true);

    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    return () => {
      isMounted = false;
      Vibration.cancel();
      try {
        ringtoneRef.current?.release();
      } catch {}
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Auto-decline countdown
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDecline();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(interval);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const cleanupAndLeave = useCallback(() => {
    Vibration.cancel();
    try {
      ringtoneRef.current?.pause();
    } catch {}
    if (router.canGoBack()) router.back();
  }, []);

  const handleAccept = useCallback(async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    Vibration.cancel();
    try {
      ringtoneRef.current?.pause();
    } catch {}

    const pathname = params.type === 'audio' ? '/AudioCallScreen' : '/VideoCallScreen';
    router.replace({
      pathname,
      params: {
        callId: params.callId,
        otherUserId: params.callerId,
        otherUserName: callerName,
        otherUserAvatar: callerAvatar,
        isCaller: 'false',
      },
    });
  }, [params, callerName, callerAvatar]);

  const handleDecline = useCallback(async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    Vibration.cancel();
    try {
      ringtoneRef.current?.pause();
    } catch {}
    await CallService.declineCall(params.callId);
    if (router.canGoBack()) router.back();
  }, [params.callId]);

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.overlay} />
      <View style={styles.avatarContainer}>
        {callerAvatar ? (
          <Image source={{ uri: callerAvatar }} style={styles.avatar} />
        ) : (
          <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
            <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
          </View>
        )}
      </View>

      <Text style={styles.callerName}>{callerName}</Text>
      <Text style={styles.callStatus}>
        {params.type === 'audio' ? 'Incoming audio call' : 'Incoming video call'} · {secondsLeft}s
      </Text>

      <View style={styles.actions}>
        <TouchableOpacity style={[styles.actionBtn, styles.declineBtn]} onPress={handleDecline} accessibilityLabel="Decline call">
          <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity style={[styles.actionBtn, styles.acceptBtn]} onPress={handleAccept} accessibilityLabel="Accept call">
            <Icon name="call" size={32} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E', alignItems: 'center', justifyContent: 'center' },
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.35)' },
  avatarContainer: { marginBottom: 20 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#FF6B9D' },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 48, color: '#fff', fontWeight: '700' },
  callerName: { fontSize: 26, fontWeight: '700', color: '#fff', marginBottom: 6 },
  callStatus: { fontSize: 15, color: 'rgba(255,255,255,0.7)', marginBottom: 48 },
  actions: { flexDirection: 'row', justifyContent: 'space-around', width: width * 0.7 },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  acceptBtn: { backgroundColor: '#22C55E' },
  declineBtn: { backgroundColor: '#EF4444' },
  declineIcon: { transform: [{ rotate: '135deg' }] },
});
