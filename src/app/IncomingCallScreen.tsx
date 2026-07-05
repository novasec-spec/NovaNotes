// src/app/call/IncomingCallScreen.tsx
import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
  Image,
  Dimensions,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import CallService from '../services/CallService';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

export default function IncomingCallScreen() {
  const { colors } = useTheme();
  const params = useLocalSearchParams<{
    callId: string;
    callerId: string;
    callerName: string;
    callerAvatar: string;
    roomName: string;
  }>();

  const [timer, setTimer] = useState(0);
  const callerName = params.callerName || 'Unknown';
  const callerAvatar = params.callerAvatar || '';

  useEffect(() => {
    // Auto-decline after 30 seconds
    const interval = setInterval(() => {
      setTimer(prev => {
        if (prev >= 30) {
          declineCall();
          return 30;
        }
        return prev + 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, []);

  const acceptCall = async () => {
    const tokenData = await CallService.acceptCall(params.callId || '');
    if (tokenData) {
      // Navigate to call screen
      router.push({
        pathname: '/call/CallScreen',
        params: {
          callId: params.callId,
          calleeId: params.callerId,
          calleeName: params.callerName,
          calleeAvatar: params.callerAvatar,
          type: 'video',
          isCaller: 'false',
        },
      });
    }
  };

  const declineCall = async () => {
    await CallService.declineCall(params.callId || '');
    router.back();
  };

  return (
    <SafeAreaView style={[styles.container, { backgroundColor: '#1A1A2E' }]}>
      <StatusBar barStyle="light-content" />
      
      <View style={styles.content}>
        {/* Avatar */}
        <View style={styles.avatarContainer}>
          {callerAvatar ? (
            <Image source={{ uri: callerAvatar }} style={styles.avatar} />
          ) : (
            <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
              <Text style={styles.avatarText}>{callerName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Caller Info */}
        <Text style={styles.callerName}>{callerName}</Text>
        <Text style={styles.callStatus}>Incoming call... {Math.max(0, 30 - timer)}s</Text>

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity style={[styles.actionButton, styles.declineButton]} onPress={declineCall}>
            <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
          </TouchableOpacity>
          <TouchableOpacity style={[styles.actionButton, styles.acceptButton]} onPress={acceptCall}>
            <Icon name="call" size={32} color="#fff" />
          </TouchableOpacity>
        </View>

        <Text style={styles.hint}>Slide to answer</Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  avatarContainer: {
    marginBottom: 24,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    alignItems: 'center',
    justifyContent: 'center',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  callerName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  callStatus: {
    fontSize: 16,
    color: '#999',
    marginBottom: 40,
  },
  actions: {
    flexDirection: 'row',
    gap: 40,
    marginBottom: 20,
  },
  actionButton: {
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
  acceptButton: {
    backgroundColor: '#22C55E',
  },
  declineButton: {
    backgroundColor: '#EF4444',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  hint: {
    fontSize: 14,
    color: '#666',
  },
});
