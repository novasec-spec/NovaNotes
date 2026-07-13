// src/app/CallingScreen.tsx
// Route '/CallingScreen' — shown to the CALLER while ringing, before the
// callee has accepted. Kept separate from VideoCallScreen/AudioCallScreen
// so the "connected room" screens only ever deal with an already-live call.

import React, { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, StatusBar, Image, ActivityIndicator } from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CallService from '../services/CallService';

const RING_TIMEOUT_SECONDS = 45;

export default function CallingScreen() {
  const params = useLocalSearchParams<{
    callId: string;
    otherUserId: string;
    otherUserName: string;
    otherUserAvatar: string;
    type: 'audio' | 'video';
  }>();

  const [status, setStatus] = useState<'ringing' | 'timedOut'>('ringing');
  const resolvedRef = useRef(false);

  const otherUserName = params.otherUserName || 'User';
  const otherUserAvatar = params.otherUserAvatar || '';

  useEffect(() => {
    if (!params.callId) {
      console.warn('⚠️ CallingScreen mounted with no callId');
      if (router.canGoBack()) router.back();
      return;
    }

    const timeout = setTimeout(() => {
      if (resolvedRef.current) return;
      resolvedRef.current = true;
      CallService.cancelCall(params.callId);
      setStatus('timedOut');
      setTimeout(() => router.canGoBack() && router.back(), 1200);
    }, RING_TIMEOUT_SECONDS * 1000);

    const unsubscribe = CallService.subscribeToCall(params.callId, (call) => {
      if (resolvedRef.current) return;

      if (call.status === 'connected') {
        resolvedRef.current = true;
        clearTimeout(timeout);
        const pathname = params.type === 'audio' ? '/AudioCallScreen' : '/VideoCallScreen';
        router.replace({
          pathname,
          params: {
            callId: params.callId,
            otherUserId: params.otherUserId,
            otherUserName,
            otherUserAvatar,
            isCaller: 'true',
          },
        });
        return;
      }

      if (['declined', 'ended', 'cancelled'].includes(call.status)) {
        resolvedRef.current = true;
        clearTimeout(timeout);
        if (router.canGoBack()) router.back();
      }
    });

    return () => {
      clearTimeout(timeout);
      unsubscribe();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.callId]);

  const handleCancel = async () => {
    if (resolvedRef.current) return;
    resolvedRef.current = true;
    await CallService.cancelCall(params.callId);
    if (router.canGoBack()) router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.content}>
        <View style={styles.avatarContainer}>
          {otherUserAvatar ? (
            <Image source={{ uri: otherUserAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
              <Text style={styles.avatarText}>{otherUserName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>
        <Text style={styles.name}>{otherUserName}</Text>
        <Text style={styles.status}>{status === 'timedOut' ? 'No answer' : 'Ringing…'}</Text>
        {status === 'ringing' && <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />}

        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel}>
          <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 30 },
  avatarContainer: { marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60 },
  avatarFallback: { width: 120, height: 120, borderRadius: 60, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 48, fontWeight: '700', color: '#fff' },
  name: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  status: { fontSize: 16, color: '#999', marginBottom: 32 },
  loader: { marginBottom: 40 },
  cancelButton: { width: 72, height: 72, borderRadius: 36, backgroundColor: '#EF4444', alignItems: 'center', justifyContent: 'center' },
  declineIcon: { transform: [{ rotate: '135deg' }] },
});
