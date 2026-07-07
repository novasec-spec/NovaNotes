// src/app/call/IncomingCallScreen.tsx
//
// Single source of truth for the incoming-call UI. Replaces the old
// duplicate pair (incoming.tsx + IncomingCallScreen.tsx) which disagreed
// on where to navigate next ('/call/active' didn't exist) and both raced
// to accept/decline independently.
//
// Delete src/app/call/incoming.tsx after adopting this file.

import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Vibration,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { Audio } from 'expo-av';
import CallService from '../services/CallService';

const { width } = Dimensions.get('window');
const RING_TIMEOUT_SECONDS = 30;
const VIBRATION_PATTERN = [0, 500, 500]; // wait, buzz, pause — repeats

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

  // Guards against double taps and against the callee tapping Accept
  // right as the caller cancels (or vice versa) — only one action ever wins.
  const resolvedRef = useRef(false);
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringtoneRef = useRef<Audio.Sound | null>(null);

  const callerName = params.callerName || callerInfo?.username || 'Unknown';
  const callerAvatar = params.callerAvatar || callerInfo?.avatar_url || '';

  // ── Load caller info (falls back to what the notification already gave us) ──
  useEffect(() => {
    if (params.callerName) return; // already have it, skip the network round trip
    CallService.getOtherUser(params.callId).then((user) => {
      if (user) setCallerInfo({ username: user.username, avatar_url: user.avatar_url });
    });
  }, [params.callId]);

  // ── Realtime: if the caller cancels before we answer, leave automatically ──
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

  // ── Ringtone + vibration + pulse animation ──
  useEffect(() => {
    let isMounted = true;

    (async () => {
      try {
        await Audio.setAudioModeAsync({ playsInSilentModeIOS: true, staysActiveInBackground: true });
        const { sound } = await Audio.Sound.createAsync(
          require('../../assets/sounds/ringtone.mp3'), // add this asset to your project
          { isLooping: true, volume: 1.0 }
        );
        if (isMounted) {
          ringtoneRef.current = sound;
          await sound.playAsync();
        } else {
          await sound.unloadAsync();
        }
      } catch (error) {
        // Missing asset shouldn't crash the call flow — vibration still works.
        console.warn('⚠️ Ringtone playback unavailable:', error);
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
      ringtoneRef.current?.unloadAsync();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Auto-decline countdown ──
  useEffect(() => {
    const interval = setInterval(() => {
      setSecondsLeft((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
          handleDecline(true);
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
    ringtoneRef.current?.stopAsync().catch(() => {});
    if (router.canGoBack()) router.back();
  }, []);

  const handleAccept = useCallback(async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    Vibration.cancel();
    ringtoneRef.current?.stopAsync().catch(() => {});

    const tokenData = await CallService.acceptCall(params.callId);
    if (!tokenData) {
      resolvedRef.current = false; // let them retry instead of getting stuck
      return;
    }

    router.replace({
      pathname: '/call/CallScreen',
      params: {
        callId: params.callId,
        calleeId: params.callerId,
        calleeName: callerName,
        calleeAvatar: callerAvatar,
        type: params.type || 'video',
        isCaller: 'false',
        preAccepted: 'true',
      },
    });
  }, [params, callerName, callerAvatar]);

  const handleDecline = useCallback(
    async (auto = false) => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      Vibration.cancel();
      ringtoneRef.current?.stopAsync().catch(() => {});
      await CallService.declineCall(params.callId);
      if (!auto && router.canGoBack()) router.back();
      else if (auto && router.canGoBack()) router.back();
    },
    [params.callId]
  );

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
        <TouchableOpacity
          style={[styles.actionBtn, styles.declineBtn]}
          onPress={() => handleDecline(false)}
          accessibilityLabel="Decline call"
        >
          <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
        </TouchableOpacity>

        <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.acceptBtn]}
            onPress={handleAccept}
            accessibilityLabel="Accept call"
          >
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
