// src/app/call/CallScreen.tsx
import React, { useState, useEffect, useRef } from 'react';
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
import { router, useLocalSearchParams } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import { RTCView, MediaStream } from 'react-native-webrtc';
import CallService from '../services/CallService';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');

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

  const [callState, setCallState] = useState<'connecting' | 'connected' | 'ended' | 'failed'>('connecting');
  const [callDuration, setCallDuration] = useState(0);
  const [isMuted, setIsMuted] = useState(false);
  const [isCameraOn, setIsCameraOn] = useState(true);
  const [isSpeakerOn, setIsSpeakerOn] = useState(false);
  const [localStream, setLocalStream] = useState<MediaStream | null>(null);
  const [remoteStream, setRemoteStream] = useState<MediaStream | null>(null);

  const durationInterval = useRef<NodeJS.Timeout | null>(null);
  const calleeName = params.calleeName || 'User';
  const calleeAvatar = params.calleeAvatar || '';
  const isCaller = params.isCaller === 'true';

  useEffect(() => {
    initializeCall();
    return () => {
      cleanupCall();
    };
  }, []);

  const initializeCall = async () => {
    try {
      if (isCaller) {
        // Caller initiates call
        const call = await CallService.initiateCall(params.calleeId || '');
        if (call) {
          // Wait for callee to accept (polling or socket)
          await waitForAcceptance(call.id);
        }
      } else {
        // Callee accepts call
        const tokenData = await CallService.acceptCall(params.callId || '');
        if (tokenData) {
          await joinCall(tokenData);
        }
      }
    } catch (error) {
      console.error('Call init error:', error);
      setCallState('failed');
    }
  };

  const waitForAcceptance = async (callId: string) => {
    // Poll for call status
    const checkStatus = async () => {
      try {
        const { data, error } = await supabase
          .from('calls')
          .select('status, room_name')
          .eq('id', callId)
          .single();

        if (error) throw error;

        if (data.status === 'connected') {
          // Get token and join call
          const tokenData = await CallService.acceptCall(callId);
          if (tokenData) {
            await joinCall(tokenData);
          }
          return;
        }

        if (data.status === 'declined' || data.status === 'ended') {
          setCallState('ended');
          router.back();
          return;
        }

        // Check again in 2 seconds
        setTimeout(checkStatus, 2000);
      } catch (error) {
        console.error('Status check error:', error);
      }
    };

    checkStatus();
  };

  const joinCall = async (tokenData: any) => {
    try {
      const success = await CallService.joinRoom(
        tokenData.token,
        tokenData.serverUrl,
        tokenData.roomName
      );

      if (success) {
        setCallState('connected');
        startTimer();
        
        // Setup event listeners
        CallService.onRoomEvents({
          onParticipantConnected: (participant) => {
            console.log('Participant connected:', participant);
          },
          onTrackSubscribed: (track, participant) => {
            // Handle remote track
            if (track.kind === 'video' || track.kind === 'audio') {
              // Add track to remote stream
            }
          },
          onDisconnected: () => {
            endCall();
          },
        });
      } else {
        setCallState('failed');
      }
    } catch (error) {
      console.error('Join call error:', error);
      setCallState('failed');
    }
  };

  const startTimer = () => {
    durationInterval.current = setInterval(() => {
      setCallDuration(prev => prev + 1);
    }, 1000);
  };

  const endCall = async () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }

    await CallService.leaveRoom();
    await CallService.endCall(params.callId || '');
    setCallState('ended');
    router.back();
  };

  const toggleMute = async () => {
    const muted = await CallService.toggleMute();
    setIsMuted(muted);
  };

  const toggleCamera = async () => {
    await CallService.flipCamera();
    setIsCameraOn(!isCameraOn);
  };

  const toggleSpeaker = () => {
    setIsSpeakerOn(!isSpeakerOn);
  };

  const cleanupCall = () => {
    if (durationInterval.current) {
      clearInterval(durationInterval.current);
    }
    CallService.leaveRoom();
  };

  const formatDuration = (seconds: number): string => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render ──────────────────────────────────────────────────────────────
  if (callState === 'connecting') {
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
          <Text style={styles.connectingText}>
            {isCaller ? 'Ringing...' : 'Connecting...'}
          </Text>
          <ActivityIndicator size="large" color="#FF6B9D" style={styles.loader} />
          <TouchableOpacity style={styles.endCallButton} onPress={endCall}>
            <Icon name="call" size={32} color="#fff" />
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  if (callState === 'connected') {
    return (
      <SafeAreaView style={[styles.container, { backgroundColor: '#1A1A2E' }]}>
        <StatusBar barStyle="light-content" />
        
        {/* Remote Video (full screen) */}
        {remoteStream && (
          <RTCView
            streamURL={remoteStream.toURL()}
            style={styles.remoteVideo}
            objectFit="cover"
          />
        )}

        {/* Local Video (PIP) */}
        {localStream && isCameraOn && (
          <RTCView
            streamURL={localStream.toURL()}
            style={styles.localVideo}
            objectFit="cover"
          />
        )}

        {/* Callee Name & Duration */}
        <View style={styles.callInfo}>
          <Text style={styles.calleeName}>{calleeName}</Text>
          <Text style={styles.callDuration}>{formatDuration(callDuration)}</Text>
        </View>

        {/* Controls */}
        <View style={styles.controls}>
          <TouchableOpacity style={styles.controlButton} onPress={toggleMute}>
            <Icon name={isMuted ? 'mic-off' : 'mic'} size={28} color="#fff" />
          </TouchableOpacity>

          <TouchableOpacity style={styles.controlButton} onPress={toggleSpeaker}>
            <Icon name={isSpeakerOn ? 'volume-high' : 'volume-low'} size={28} color="#fff" />
          </TouchableOpacity>

          {params.type === 'video' && (
            <TouchableOpacity style={styles.controlButton} onPress={toggleCamera}>
              <Icon name={isCameraOn ? 'camera' : 'camera-off'} size={28} color="#fff" />
            </TouchableOpacity>
          )}

          <TouchableOpacity style={[styles.controlButton, styles.endCall]} onPress={endCall}>
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

  return null;
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  connectingContainer: {
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
  calleeName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
  },
  connectingText: {
    fontSize: 16,
    color: '#999',
    marginBottom: 32,
  },
  loader: { marginBottom: 40 },
  endCallButton: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: '#EF4444',
    alignItems: 'center',
    justifyContent: 'center',
  },
  remoteVideo: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  localVideo: {
    position: 'absolute',
    top: 60,
    right: 20,
    width: 120,
    height: 160,
    borderRadius: 16,
    borderWidth: 2,
    borderColor: '#fff',
  },
  callInfo: {
    position: 'absolute',
    top: 60,
    left: 0,
    right: 0,
    alignItems: 'center',
  },
  callDuration: {
    fontSize: 16,
    color: '#fff',
    marginTop: 4,
  },
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
  endCall: {
    backgroundColor: '#EF4444',
    width: 64,
    height: 64,
    borderRadius: 32,
  },
  failedContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
  },
  failedTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#fff',
    marginTop: 16,
  },
  failedText: {
    fontSize: 16,
    color: '#999',
    marginTop: 8,
    marginBottom: 32,
  },
  tryAgainButton: {
    paddingHorizontal: 32,
    paddingVertical: 14,
    backgroundColor: '#FF6B9D',
    borderRadius: 25,
  },
  tryAgainText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#fff',
  },
});
