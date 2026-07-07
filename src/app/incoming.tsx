import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Image,
  Animated,
  Dimensions,
  Vibration,
  StatusBar,
  PanResponder,
  GestureResponderEvent,
  PanResponderGestureState,
} from 'react-native';
import { router, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';
import CallService from '../services/CallService';
import { supabase } from '../config/supabase';

const { width, height } = Dimensions.get('window');
const SLIDE_THRESHOLD = width * 0.3;

// ─── Animated Ring Component ─────────────────────────────────────────

const AnimatedRing = ({ delay, scale, opacity }: { delay: number; scale: Animated.Value; opacity: Animated.Value }) => {
  return (
    <Animated.View
      style={[
        styles.ring,
        {
          transform: [{ scale }],
          opacity,
        },
      ]}
    />
  );
};

// ─── Main Component ──────────────────────────────────────────────────

export default function IncomingCallScreen() {
  const { callId, callerId, callerName, callerAvatar, roomName, type = 'video' } = useLocalSearchParams();
  const { colors } = useTheme();

  // State
  const [callerInfo, setCallerInfo] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [timer, setTimer] = useState(0);
  const [isAccepting, setIsAccepting] = useState(false);
  const [isDeclining, setIsDeclining] = useState(false);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const ring1Scale = useRef(new Animated.Value(0.8)).current;
  const ring1Opacity = useRef(new Animated.Value(0.6)).current;
  const ring2Scale = useRef(new Animated.Value(0.6)).current;
  const ring2Opacity = useRef(new Animated.Value(0.4)).current;
  const ring3Scale = useRef(new Animated.Value(0.4)).current;
  const ring3Opacity = useRef(new Animated.Value(0.2)).current;
  const slideAnim = useRef(new Animated.Value(0)).current;
  const declineSlideAnim = useRef(new Animated.Value(0)).current;
  const fadeIn = useRef(new Animated.Value(0)).current;

  // Refs
  const mounted = useRef(true);
  const timerInterval = useRef<NodeJS.Timeout | null>(null);
  const autoDeclineTimeout = useRef<NodeJS.Timeout | null>(null);

  // ─── Effects ───────────────────────────────────────────────────────

  useEffect(() => {
    mounted.current = true;
    
    loadCallerInfo();
    startAnimations();
    startVibration();
    startAutoDeclineTimer();
    startCountdownTimer();

    // Entrance animation
    Animated.timing(fadeIn, {
      toValue: 1,
      duration: 400,
      useNativeDriver: true,
    }).start();

    return () => {
      mounted.current = false;
      Vibration.cancel();
      if (timerInterval.current) clearInterval(timerInterval.current);
      if (autoDeclineTimeout.current) clearTimeout(autoDeclineTimeout.current);
    };
  }, []);

  // ─── Data Loading ────────────────────────────────────────────────────

  const loadCallerInfo = async () => {
    try {
      // Try to get from params first
      if (callerName && callerAvatar) {
        setCallerInfo({ username: callerName, avatar_url: callerAvatar });
        setLoading(false);
        return;
      }

      // Fallback to database
      const { data, error } = await supabase
        .from('users')
        .select('username, avatar_url, full_name')
        .eq('id', callerId)
        .single();

      if (!error && data) {
        setCallerInfo(data);
      }
    } catch (error) {
      console.error('Load caller error:', error);
    } finally {
      setLoading(false);
    }
  };

  // ─── Animations ──────────────────────────────────────────────────────

  const startAnimations = () => {
    // Pulse animation for accept button
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.15,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Ring animations
    const animateRing = (scale: Animated.Value, opacity: Animated.Value, delay: number) => {
      Animated.loop(
        Animated.sequence([
          Animated.delay(delay),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 2.5,
              duration: 3000,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0,
              duration: 3000,
              useNativeDriver: true,
            }),
          ]),
          Animated.parallel([
            Animated.timing(scale, {
              toValue: 0.8,
              duration: 0,
              useNativeDriver: true,
            }),
            Animated.timing(opacity, {
              toValue: 0.6,
              duration: 0,
              useNativeDriver: true,
            }),
          ]),
        ])
      ).start();
    };

    animateRing(ring1Scale, ring1Opacity, 0);
    animateRing(ring2Scale, ring2Opacity, 1000);
    animateRing(ring3Scale, ring3Opacity, 2000);
  };

  const startVibration = () => {
    // Pattern: vibrate 500ms, pause 500ms, repeat
    Vibration.vibrate([500, 500, 500, 500, 500, 500, 500, 500], true);
  };

  const startAutoDeclineTimer = () => {
    // Auto-decline after 45 seconds
    autoDeclineTimeout.current = setTimeout(() => {
      if (mounted.current) {
        handleDecline();
      }
    }, 45000);
  };

  const startCountdownTimer = () => {
    timerInterval.current = setInterval(() => {
      setTimer((prev) => prev + 1);
    }, 1000);
  };

  // ─── Pan Responders (Slide to Answer/Decline) ────────────────────────

  const acceptPanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 || gestureState.dy < -10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          slideAnim.setValue(Math.min(gestureState.dy, 150));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SLIDE_THRESHOLD) {
          handleAccept();
        } else {
          Animated.spring(slideAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  const declinePanResponder = useRef(
    PanResponder.create({
      onStartShouldSetPanResponder: () => true,
      onMoveShouldSetPanResponder: (_, gestureState) => {
        return gestureState.dy > 10 || gestureState.dy < -10;
      },
      onPanResponderMove: (_, gestureState) => {
        if (gestureState.dy > 0) {
          declineSlideAnim.setValue(Math.min(gestureState.dy, 150));
        }
      },
      onPanResponderRelease: (_, gestureState) => {
        if (gestureState.dy > SLIDE_THRESHOLD) {
          handleDecline();
        } else {
          Animated.spring(declineSlideAnim, {
            toValue: 0,
            useNativeDriver: true,
            friction: 8,
          }).start();
        }
      },
    })
  ).current;

  // ─── Actions ───────────────────────────────────────────────────────

  const handleAccept = async () => {
    if (isAccepting || isDeclining) return;
    setIsAccepting(true);
    Vibration.cancel();

    try {
      const tokenData = await CallService.acceptCall(callId as string);
      
      if (tokenData) {
        router.replace({
          pathname: '/call/active',
          params: {
            callId,
            callerId,
            callerName: callerName || callerInfo?.username,
            type,
          },
        });
      } else {
        setIsAccepting(false);
      }
    } catch (error) {
      console.error('Accept call error:', error);
      setIsAccepting(false);
    }
  };

  const handleDecline = async () => {
    if (isAccepting || isDeclining) return;
    setIsDeclining(true);
    Vibration.cancel();

    try {
      await CallService.declineCall(callId as string);
      router.back();
    } catch (error) {
      console.error('Decline call error:', error);
      router.back();
    }
  };

  // ─── Render Helpers ────────────────────────────────────────────────

  const displayName = callerName || callerInfo?.username || callerInfo?.full_name || 'Unknown';
  const displayAvatar = callerAvatar || callerInfo?.avatar_url;
  const timeRemaining = Math.max(0, 45 - timer);

  if (loading) {
    return (
      <View style={styles.container}>
        <StatusBar barStyle="light-content" />
        <View style={styles.loadingContainer}>
          <View style={styles.loadingRing} />
          <Text style={styles.loadingText}>Loading...</Text>
        </View>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar barStyle="light-content" />
      
      <Animated.View style={[styles.content, { opacity: fadeIn }]}>
        {/* Background gradient overlay */}
        <View style={styles.backgroundOverlay} />

        {/* Animated Rings */}
        <View style={styles.ringsContainer} pointerEvents="none">
          <AnimatedRing delay={0} scale={ring3Scale} opacity={ring3Opacity} />
          <AnimatedRing delay={1000} scale={ring2Scale} opacity={ring2Opacity} />
          <AnimatedRing delay={2000} scale={ring1Scale} opacity={ring1Opacity} />
        </View>

        {/* Caller Avatar */}
        <View style={styles.avatarContainer}>
          {displayAvatar ? (
            <Image source={{ uri: displayAvatar }} style={styles.avatar} />
          ) : (
            <View style={styles.avatarFallback}>
              <Text style={styles.avatarText}>{displayName.charAt(0).toUpperCase()}</Text>
            </View>
          )}
        </View>

        {/* Caller Info */}
        <View style={styles.infoContainer}>
          <Text style={styles.callerName}>{displayName}</Text>
          <View style={styles.callTypeRow}>
            <Icon 
              name={type === 'video' ? 'videocam' : 'call'} 
              size={16} 
              color="rgba(255,255,255,0.6)" 
            />
            <Text style={styles.callTypeText}>
              {type === 'video' ? 'Video Call' : 'Audio Call'}
            </Text>
          </View>
          <Text style={styles.timerText}>
            {isAccepting ? 'Connecting...' : `Incoming call • ${timeRemaining}s`}
          </Text>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsContainer}>
          {/* Decline Button */}
          <View style={styles.actionWrapper}>
            <Animated.View
              style={{ transform: [{ translateY: declineSlideAnim }] }}
              {...declinePanResponder.panHandlers}
            >
              <TouchableOpacity
                style={[styles.actionBtn, styles.declineBtn, isDeclining && styles.btnDisabled]}
                onPress={handleDecline}
                disabled={isDeclining || isAccepting}
                activeOpacity={0.8}
              >
                <Icon name="call" size={32} color="#fff" style={styles.declineIcon} />
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Decline</Text>
          </View>

          {/* Accept Button */}
          <View style={styles.actionWrapper}>
            <Animated.View
              style={{ transform: [{ scale: pulseAnim }, { translateY: slideAnim }] }}
              {...acceptPanResponder.panHandlers}
            >
              <TouchableOpacity
                style={[styles.actionBtn, styles.acceptBtn, isAccepting && styles.btnDisabled]}
                onPress={handleAccept}
                disabled={isAccepting || isDeclining}
                activeOpacity={0.8}
              >
                {isAccepting ? (
                  <View style={styles.spinner}>
                    <View style={styles.spinnerDot} />
                  </View>
                ) : (
                  <Icon name="call" size={32} color="#fff" />
                )}
              </TouchableOpacity>
            </Animated.View>
            <Text style={styles.actionLabel}>Accept</Text>
          </View>
        </View>

        {/* Swipe hint */}
        <Text style={styles.hintText}>Swipe up to answer</Text>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ──────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F0F1A',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  backgroundOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(15,15,26,0.9)',
  },

  // Loading
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingRing: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 3,
    borderColor: '#FF6B9D',
    borderTopColor: 'transparent',
    marginBottom: 16,
  },
  loadingText: {
    color: 'rgba(255,255,255,0.6)',
    fontSize: 16,
  },

  // Rings
  ringsContainer: {
    position: 'absolute',
    top: height * 0.15,
    left: 0,
    right: 0,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ring: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 1,
    borderColor: 'rgba(255,107,157,0.3)',
  },

  // Avatar
  avatarContainer: {
    marginTop: height * 0.08,
    marginBottom: 24,
    zIndex: 10,
  },
  avatar: {
    width: 120,
    height: 120,
    borderRadius: 60,
    borderWidth: 3,
    borderColor: '#FF6B9D',
  },
  avatarFallback: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#FF6B9D',
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 3,
    borderColor: 'rgba(255,107,157,0.5)',
  },
  avatarText: {
    fontSize: 48,
    fontWeight: '700',
    color: '#fff',
  },

  // Info
  infoContainer: {
    alignItems: 'center',
    marginBottom: height * 0.15,
    zIndex: 10,
  },
  callerName: {
    fontSize: 32,
    fontWeight: '700',
    color: '#fff',
    marginBottom: 8,
    textAlign: 'center',
    paddingHorizontal: 20,
  },
  callTypeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 12,
  },
  callTypeText: {
    fontSize: 16,
    color: 'rgba(255,255,255,0.6)',
  },
  timerText: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.4)',
    fontVariant: ['tabular-nums'],
  },

  // Actions
  actionsContainer: {
    flexDirection: 'row',
    justifyContent: 'space-around',
    width: width * 0.7,
    marginBottom: 30,
    zIndex: 10,
  },
  actionWrapper: {
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 10,
  },
  acceptBtn: {
    backgroundColor: '#22C55E',
  },
  declineBtn: {
    backgroundColor: '#EF4444',
  },
  declineIcon: {
    transform: [{ rotate: '135deg' }],
  },
  actionLabel: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 14,
    fontWeight: '500',
  },
  btnDisabled: {
    opacity: 0.6,
  },

  // Spinner
  spinner: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  spinnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#fff',
  },

  // Hint
  hintText: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.3)',
    marginTop: 10,
  },
});
