import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Dimensions,
  ActivityIndicator,
  Alert,
  Animated,
  StatusBar,
  Platform,
  BackHandler,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import CallService, { CallState, CallCallbacks } from '../services/CallService';

const { width, height } = Dimensions.get('window');

// ─── Network Quality Indicator ───────────────────────────────────────

const ConnectionQualityBar = ({ quality }: { quality: string }) => {
  const getColor = () => {
    switch (quality) {
      case 'excellent': return '#22C55E';
      case 'good': return '#EAB308';
      case 'poor': return '#EF4444';
      default: return '#6B7280';
    }
  };

  const getBars = () => {
    switch (quality) {
      case 'excellent': return 4;
      case 'good': return 3;
      case 'poor': return 1;
      default: return 0;
    }
  };

  return (
    <View style={styles.qualityContainer}>
      {[1, 2, 3, 4].map((bar) => (
        <View
          key={bar}
          style={[
            styles.qualityBar,
            {
              height: 4 + bar * 3,
              backgroundColor: bar <= getBars() ? getColor() : 'rgba(255,255,255,0.2)',
            },
          ]}
        />
      ))}
    </View>
  );
};

// ─── Main Component ──────────────────────────────────────────────────

export default function ActiveCallScreen() {
  const { callId, callerId, callerName, type = 'video' } = useLocalSearchParams();
  const { colors } = useTheme();

  // State
  const [callState, setCallState] = useState<CallState>(CallService.getCallState());
  const [showControls, setShowControls] = useState(true);
  const [isConnecting, setIsConnecting] = useState(true);
  
  // Animations
  const controlsOpacity = useRef(new Animated.Value(1)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(50)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

  // Refs
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const mounted = useRef(true);

  // ─── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true;
    
    // Entrance animation
    Animated.parallel([
      Animated.timing(fadeAnim, { toValue: 1, duration: 400, useNativeDriver: true }),
      Animated.timing(slideAnim, { toValue: 0, duration: 400, useNativeDriver: true }),
    ]).start();

    // Set up call service callbacks
    const callbacks: CallCallbacks = {
      onStateChange: (state) => {
        if (mounted.current) {
          setCallState(state);
          if (state.status === 'connected') {
            setIsConnecting(false);
          }
        }
      },
      onCallEnded: (reason) => {
        if (mounted.current) {
          handleCallEnded(reason);
        }
      },
      onError: (error) => {
        if (mounted.current) {
          Alert.alert('Call Error', error.message, [
            { text: 'OK', onPress: () => router.back() }
          ]);
        }
      },
    };

    CallService.setCallbacks(callbacks);

    // Join the call if not already connected
    if (CallService.getCallState().status !== 'connected') {
      joinCall();
    } else {
      setIsConnecting(false);
    }

    // Handle back button
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      confirmEndCall();
      return true;
    });

    return () => {
      mounted.current = false;
      backHandler.remove();
      CallService.clearCallbacks();
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    };
  }, []);

  // Pulse animation for connecting state
  useEffect(() => {
    if (isConnecting) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, { toValue: 1.2, duration: 1000, useNativeDriver: true }),
          Animated.timing(pulseAnim, { toValue: 1, duration: 1000, useNativeDriver: true }),
        ])
      ).start();
    }
  }, [isConnecting]);

  // ─── Call Logic ──────────────────────────────────────────────────────

  const joinCall = async () => {
    try {
      const success = await CallService.joinCall(callId as string);
      if (!success) {
        throw new Error('Failed to join call');
      }
    } catch (error) {
      console.error('Join call error:', error);
      if (mounted.current) {
        Alert.alert('Connection Failed', 'Could not connect to the call.', [
          { text: 'OK', onPress: () => router.back() }
        ]);
      }
    }
  };

  const handleCallEnded = (reason: string) => {
    Alert.alert('Call Ended', reason, [
      { text: 'OK', onPress: () => router.back() }
    ]);
  };

  const confirmEndCall = () => {
    Alert.alert(
      'End Call?',
      'Are you sure you want to end this call?',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'End', 
          style: 'destructive',
          onPress: async () => {
            await CallService.endCall(callId as string);
            router.back();
          }
        },
      ]
    );
  };

  // ─── Controls ────────────────────────────────────────────────────────

  const handleToggleMute = async () => {
    await CallService.toggleMute();
  };

  const handleToggleCamera = async () => {
    await CallService.toggleCamera();
  };

  const handleSwitchCamera = async () => {
    await CallService.switchCamera();
  };

  const handleToggleSpeaker = async () => {
    await CallService.toggleSpeaker();
  };

  const handleEndCall = async () => {
    await CallService.endCall(callId as string);
    router.back();
  };

  // ─── UI Interactions ─────────────────────────────────────────────────

  const handleVideoPress = () => {
    setShowControls(true);
    Animated.timing(controlsOpacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    controlsTimeoutRef.current = setTimeout(() => {
      Animated.timing(controlsOpacity, { toValue: 0, duration: 300, useNativeDriver: true }).start(() => {
        setShowControls(false);
      });
    }, 4000);
  };

  // ─── Formatters ──────────────────────────────────────────────────────

  const formatDuration = (seconds: number): string => {
    const hrs = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;
    
    if (hrs > 0) {
      return `${hrs}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  // ─── Render ────────────────────────────────────────────────────────

  if (isConnecting) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.connectingOverlay}>
          <Animated.View style={[styles.connectingAvatar, { transform: [{ scale: pulseAnim }] }]}>
            <Icon name="person" size={48} color="#fff" />
          </Animated.View>
          <Text style={styles.connectingText}>Connecting...</Text>
          <Text style={styles.connectingSubtext}>{callerName || 'User'}</Text>
          <TouchableOpacity style={styles.cancelButton} onPress={handleEndCall}>
            <Text style={styles.cancelText}>Cancel</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" hidden={!showControls} />
      
      {/* Remote Video (Full Screen) */}
      <TouchableOpacity 
        style={styles.videoContainer} 
        activeOpacity={1}
        onPress={handleVideoPress}
      >
        {callState.remoteStream ? (
          <View style={styles.remoteVideo}>
            {/* Use react-native-webrtc RTCView here */}
            <View style={styles.videoPlaceholder}>
              <Icon name="videocam" size={40} color="rgba(255,255,255,0.3)" />
              <Text style={styles.videoPlaceholderText}>Remote Video</Text>
            </View>
          </View>
        ) : (
          <View style={styles.noVideoContainer}>
            <View style={styles.avatarLarge}>
              <Text style={styles.avatarLargeText}>
                {(callerName as string)?.charAt(0)?.toUpperCase() || '?'}
              </Text>
            </View>
            <Text style={styles.noVideoName}>{callerName || 'User'}</Text>
            <Text style={styles.noVideoStatus}>
              {callState.status === 'connecting' ? 'Connecting...' : 'Camera off'}
            </Text>
          </View>
        )}
      </TouchableOpacity>

      {/* Local Video (PIP) */}
      {callState.isCameraOn && (
        <Animated.View 
          style={[
            styles.localVideoContainer,
            { opacity: fadeAnim, transform: [{ translateY: slideAnim }] }
          ]}
        >
          <View style={styles.localVideo}>
            <View style={styles.localVideoPlaceholder}>
              <Icon name="videocam" size={20} color="rgba(255,255,255,0.5)" />
            </View>
          </View>
          <TouchableOpacity style={styles.pipSwitchBtn} onPress={handleSwitchCamera}>
            <Icon name="camera-reverse" size={16} color="#fff" />
          </TouchableOpacity>
        </Animated.View>
      )}

      {/* Top Info Bar */}
      <Animated.View 
        style={[
          styles.topBar,
          { opacity: fadeAnim }
        ]}
      >
        <View style={styles.topBarContent}>
          <View style={styles.callerInfo}>
            <Text style={styles.callerName}>{callerName || 'User'}</Text>
            <View style={styles.durationRow}>
              <View style={[styles.dot, callState.status === 'connected' && styles.dotActive]} />
              <Text style={styles.duration}>{formatDuration(callState.duration)}</Text>
            </View>
          </View>
          <ConnectionQualityBar quality={callState.connectionQuality} />
        </View>
      </Animated.View>

      {/* Controls */}
      {showControls && (
        <Animated.View style={[styles.controlsContainer, { opacity: controlsOpacity }]}>
          <View style={styles.controls}>
            {/* Mute */}
            <TouchableOpacity 
              style={[styles.controlBtn, callState.isMuted && styles.controlBtnActive]} 
              onPress={handleToggleMute}
              activeOpacity={0.7}
            >
              <Icon
                name={callState.isMuted ? 'mic-off' : 'mic'}
                size={26}
                color={callState.isMuted ? '#EF4444' : '#fff'}
              />
              <Text style={[styles.controlLabel, callState.isMuted && styles.controlLabelActive]}>
                {callState.isMuted ? 'Unmute' : 'Mute'}
              </Text>
            </TouchableOpacity>

            {/* Camera */}
            {type === 'video' && (
              <TouchableOpacity 
                style={[styles.controlBtn, !callState.isCameraOn && styles.controlBtnActive]} 
                onPress={handleToggleCamera}
                activeOpacity={0.7}
              >
                <Icon
                  name={callState.isCameraOn ? 'videocam' : 'videocam-off'}
                  size={26}
                  color={!callState.isCameraOn ? '#EF4444' : '#fff'}
                />
                <Text style={[styles.controlLabel, !callState.isCameraOn && styles.controlLabelActive]}>
                  {callState.isCameraOn ? 'Camera' : 'Camera Off'}
                </Text>
              </TouchableOpacity>
            )}

            {/* Speaker */}
            <TouchableOpacity 
              style={[styles.controlBtn, callState.isSpeakerOn && styles.controlBtnActive]} 
              onPress={handleToggleSpeaker}
              activeOpacity={0.7}
            >
              <Icon
                name={callState.isSpeakerOn ? 'volume-high' : 'volume-low'}
                size={26}
                color="#fff"
              />
              <Text style={styles.controlLabel}>
                {callState.isSpeakerOn ? 'Speaker' : 'Earpiece'}
              </Text>
            </TouchableOpacity>

            {/* End Call */}
            <TouchableOpacity
              style={[styles.controlBtn, styles.endCallBtn]}
              onPress={handleEndCall}
              activeOpacity={0.7}
            >
              <Icon name="call" size={28} color="#fff" />
              <Text style={[styles.controlLabel, styles.endCallLabel]}>End</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      )}
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  
  // Connecting State
  connectingOverlay: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: '#0F0F1A',
  },
  connectingAvatar: {
    width: 100,
    height: 100,
    borderRadius: 50,
    backgroundColor: 'rgba(255,107,157,0.2)',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 24,
  },
  connectingText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: '600',
    marginBottom: 8,
  },
  connectingSubtext: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
    marginBottom: 40,
  },
  cancelButton: {
    paddingHorizontal: 32,
    paddingVertical: 12,
    backgroundColor: 'rgba(239,68,68,0.2)',
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#EF4444',
  },
  cancelText: {
    color: '#EF4444',
    fontSize: 16,
    fontWeight: '600',
  },

  // Video
  videoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  remoteVideo: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: '#1A1A2E',
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  videoPlaceholderText: {
    color: 'rgba(255,255,255,0.3)',
    fontSize: 14,
    marginTop: 8,
  },

  // No Video
  noVideoContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarLarge: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 16,
  },
  avatarLargeText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },
  noVideoName: {
    color: '#fff',
    fontSize: 24,
    fontWeight: '600',
    marginBottom: 8,
  },
  noVideoStatus: {
    color: 'rgba(255,255,255,0.5)',
    fontSize: 16,
  },

  // Local Video PIP
  localVideoContainer: {
    position: 'absolute',
    top: Platform.OS === 'ios' ? 100 : 80,
    right: 20,
    width: 110,
    height: 150,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#1A1A2E',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.2)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  localVideo: {
    flex: 1,
    backgroundColor: '#1A1A2E',
  },
  localVideoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  pipSwitchBtn: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },

  // Top Bar
  topBar: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    paddingTop: Platform.OS === 'ios' ? 50 : 40,
    paddingHorizontal: 20,
    paddingBottom: 16,
    backgroundColor: 'rgba(0,0,0,0.4)',
  },
  topBarContent: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callerInfo: {
    flex: 1,
  },
  callerName: {
    color: '#fff',
    fontSize: 18,
    fontWeight: '600',
  },
  durationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: 'rgba(255,255,255,0.3)',
    marginRight: 8,
  },
  dotActive: {
    backgroundColor: '#22C55E',
  },
  duration: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontVariant: ['tabular-nums'],
  },

  // Quality
  qualityContainer: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    gap: 2,
    height: 20,
  },
  qualityBar: {
    width: 3,
    borderRadius: 1.5,
  },

  // Controls
  controlsContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingBottom: Platform.OS === 'ios' ? 40 : 30,
    paddingTop: 20,
    backgroundColor: 'rgba(0,0,0,0.6)',
    backdropFilter: 'blur(10px)',
  },
  controls: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'flex-end',
    paddingHorizontal: 20,
  },
  controlBtn: {
    alignItems: 'center',
    justifyContent: 'center',
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: 'rgba(255,255,255,0.15)',
    gap: 4,
  },
  controlBtnActive: {
    backgroundColor: 'rgba(239,68,68,0.3)',
  },
  controlLabel: {
    color: 'rgba(255,255,255,0.8)',
    fontSize: 11,
    marginTop: 2,
  },
  controlLabelActive: {
    color: '#EF4444',
  },
  endCallBtn: {
    backgroundColor: '#EF4444',
    width: 72,
    height: 72,
    borderRadius: 36,
    shadowColor: '#EF4444',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.4,
    shadowRadius: 8,
    elevation: 8,
  },
  endCallLabel: {
    color: '#fff',
    fontWeight: '600',
  },
});
