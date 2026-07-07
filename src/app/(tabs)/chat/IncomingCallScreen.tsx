// src/app/(tabs)/chat/IncomingCallScreen.tsx
import React, { useRef, useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons as Icon } from '@expo/vector-icons';
import { useTheme } from '../../../contexts/ThemeContext';
import CallService from '../../../services/CallService';
import { supabase } from '../../../config/supabase';

const { width } = Dimensions.get('window');
const AUTO_DECLINE_SECONDS = 30;

export default function IncomingCallScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    roomName: string;
  }>();

  const [callerInfo, setCallerInfo] = useState<{ username: string; avatar_url?: string } | null>(null);
  const [timer, setTimer] = useState(0);
  const [responding, setResponding] = useState(false);

  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ringAnim = useRef(new Animated.Value(0)).current;
  const unsubscribeStatus = useRef<(() => void) | null>(null);

  const callerName = params.callerName || callerInfo?.username || 'Unknown';
  const callerAvatar = params.callerAvatar || callerInfo?.avatar_url || '';

  useEffect(() => {
    if (!params.callerName && params.callerId) {
      loadCallerInfo();
    }
    startAnimations();
    Vibration.vibrate([500, 500, 500, 500, 500, 500], true);

    // If the caller hangs up before we answer, get out immediately —
    // don't wait for the 30s timeout to notice.
    unsubscribeStatus.current = CallService.subscribeToCallStatus(params.callId, (status) => {
      if (status === 'ended' || status === 'missed') {
        cleanupAndExit();
      }
    });

    const interval = setInterval(() => {
      setTimer((prev) => {
        if (prev >= AUTO_DECLINE_SECONDS) {
          handleDecline();
          return AUTO_DECLINE_SECONDS;
        }
        return prev + 1;
      });
    }, 1000);

    return () => {
      clearInterval(interval);
      Vibration.cancel();
      unsubscribeStatus.current?.();
    };
  }, []);

  const cleanupAndExit = () => {
    Vibration.cancel();
    unsubscribeStatus.current?.();
    if (router.canGoBack()) router.back();
  };

  const loadCallerInfo = async () => {
    try {
      const { data, error } = await supabase
        .from('users')
        .select('username, avatar_url')
        .eq('id', params.callerId)
        .single();

      if (!error && data) setCallerInfo(data);
    } catch (error) {
      console.error('Load caller error:', error);
    }
  };

  const startAnimations = () => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, { toValue: 1.1, duration: 800, useNativeDriver: true }),
        Animated.timing(pulseAnim, { toValue: 1, duration: 800, useNativeDriver: true }),
      ])
    ).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(ringAnim, { toValue: 1, duration: 500, useNativeDriver: true }),
        Animated.timing(ringAnim, { toValue: 0, duration: 500, useNativeDriver: true }),
      ])
    ).start();
  };

  const handleAccept = async () => {
    if (responding) return;
    setResponding(true);
    Vibration.cancel();
    unsubscribeStatus.current?.();

    const tokenData = await CallService.acceptCall(params.callId);
    if (!tokenData) {
      setResponding(false);
      router.back();
      return;
    }

    router.replace({
      pathname: '/(tabs)/chat/CallScreen',
      params: {
        callId: params.callId,
        calleeId: params.callerId,
        calleeName: callerName,
        calleeAvatar: callerAvatar,
        type: 'video',
        isCaller: 'false',
      },
    });
  };

  const handleDecline = async () => {
    if (responding) return;
    setResponding(true);
    Vibration.cancel();
    unsubscribeStatus.current?.();
    await CallService.declineCall(params.callId);
    if (router.canGoBack()) router.back();
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      <View style={styles.overlay} />

      <View style={styles.content}>
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
          Incoming call... {Math.max(0, AUTO_DECLINE_SECONDS - timer)}s
        </Text>

        <View style={styles.ringContainer} pointerEvents="none">
          <Animated.View
            style={[
              styles.ring,
              {
                opacity: ringAnim,
                transform: [
                  { scale: ringAnim.interpolate({ inputRange: [0, 1], outputRange: [0.8, 1.2] }) },
                ],
              },
            ]}
          />
        </View>

        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.actionBtn, styles.declineBtn]}
            onPress={handleDecline}
            disabled={responding}
          >
            <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
          </TouchableOpacity>

          <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
            <TouchableOpacity
              style={[styles.actionBtn, styles.acceptBtn]}
              onPress={handleAccept}
              disabled={responding}
            >
              <Icon name="call" size={32} color="#fff" />
            </TouchableOpacity>
          </Animated.View>
        </View>

        <Text style={styles.hint}>
          {responding ? 'Connecting...' : 'Tap to answer'}
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  overlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  avatarContainer: { marginBottom: 24 },
  avatar: { width: 120, height: 120, borderRadius: 60, borderWidth: 3, borderColor: '#FF6B9D' },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: { fontSize: 48, fontWeight: '700', color: '#fff' },
  callerName: { fontSize: 24, fontWeight: '700', color: '#fff', marginBottom: 8 },
  callStatus: { fontSize: 16, color: '#999', marginBottom: 32 },
  ringContainer: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    marginTop: -150,
    marginLeft: -150,
    width: 300,
    height: 300,
    justifyContent: 'center',
    alignItems: 'center',
  },
  ring: {
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.15)',
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
    marginTop: 40,
    marginBottom: 20,
  },
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
  hint: { fontSize: 14, color: '#666' },
});
