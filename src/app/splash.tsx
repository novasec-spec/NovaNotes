// app/splash.tsx - Dark & Moody Splash Screen
import React, { useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Dimensions,
  StatusBar,
  TouchableOpacity,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { LinearGradient } from 'expo-linear-gradient';
import Icon from 'react-native-vector-icons/Ionicons';
import { useTheme } from '../contexts/ThemeContext';

const { width, height } = Dimensions.get('window');

export default function SplashScreen() {
  const { colors, isDarkMode } = useTheme();
  const [isFirstLaunch, setIsFirstLaunch] = React.useState(true);
  
  // Animations
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.8)).current;
  const heartScale = useRef(new Animated.Value(0)).current;
  const textFade = useRef(new Animated.Value(0)).current;
  const subtitleFade = useRef(new Animated.Value(0)).current;
  const buttonFade = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const glowAnim = useRef(new Animated.Value(0)).current;
  const rotateAnim = useRef(new Animated.Value(0)).current;
  const shimmerAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    checkFirstLaunch();
    startAnimations();
    
    // Floating animation
    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 2000,
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 2000,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(glowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(glowAnim, {
          toValue: 0,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();

    // Rotation
    Animated.loop(
      Animated.timing(rotateAnim, {
        toValue: 1,
        duration: 20000,
        useNativeDriver: true,
      })
    ).start();

    // Shimmer
    Animated.loop(
      Animated.sequence([
        Animated.timing(shimmerAnim, {
          toValue: 1,
          duration: 3000,
          useNativeDriver: true,
        }),
        Animated.timing(shimmerAnim, {
          toValue: 0,
          duration: 3000,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  const checkFirstLaunch = async () => {
    try {
      const hasLaunched = await AsyncStorage.getItem('hasLaunched');
      if (hasLaunched === 'true') {
        setIsFirstLaunch(false);
        setTimeout(() => {
          router.replace('/(tabs)');
        }, 5000);
      } else {
        setIsFirstLaunch(true);
      }
    } catch (error) {
      console.error('Error checking first launch:', error);
      setIsFirstLaunch(true);
    }
  };

  const startAnimations = () => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();

    Animated.spring(heartScale, {
      toValue: 1,
      friction: 4,
      tension: 80,
      useNativeDriver: true,
    }).start();

    Animated.spring(scaleAnim, {
      toValue: 1,
      friction: 6,
      tension: 50,
      useNativeDriver: true,
    }).start();

    Animated.timing(textFade, {
      toValue: 1,
      duration: 800,
      delay: 300,
      useNativeDriver: true,
    }).start();

    Animated.timing(subtitleFade, {
      toValue: 1,
      duration: 800,
      delay: 600,
      useNativeDriver: true,
    }).start();

    Animated.timing(buttonFade, {
      toValue: 1,
      duration: 800,
      delay: 900,
      useNativeDriver: true,
    }).start();
  };

  const handleEnterApp = async () => {
    try {
      await AsyncStorage.setItem('hasLaunched', 'true');
      router.replace('/(tabs)');
    } catch (error) {
      console.error('Error saving launch status:', error);
      router.replace('/(tabs)');
    }
  };

  // Background floating stars
  const stars = [
    { size: 3, top: '5%', left: '10%', delay: 0 },
    { size: 2, top: '8%', right: '15%', delay: 0.5 },
    { size: 4, bottom: '25%', left: '8%', delay: 1 },
    { size: 2, bottom: '35%', right: '10%', delay: 1.5 },
    { size: 3, top: '35%', left: '5%', delay: 0.8 },
    { size: 4, top: '50%', right: '8%', delay: 1.2 },
    { size: 2, bottom: '10%', left: '20%', delay: 0.3 },
    { size: 3, bottom: '15%', right: '22%', delay: 0.7 },
    { size: 2, top: '70%', left: '30%', delay: 0.4 },
    { size: 3, top: '85%', right: '40%', delay: 0.9 },
  ];

  // Floating hearts (subtle, muted pink)
  const hearts = [
    { size: 25, top: '12%', left: '5%', delay: 0.2 },
    { size: 18, top: '20%', right: '8%', delay: 0.7 },
    { size: 22, bottom: '30%', left: '4%', delay: 1.2 },
    { size: 16, bottom: '20%', right: '5%', delay: 0.5 },
  ];

  const spin = rotateAnim.interpolate({
    inputRange: [0, 1],
    outputRange: ['0deg', '360deg'],
  });

  const shimmerTranslate = shimmerAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [-width, width],
  });

  return (
    <View style={styles.container}>
      <StatusBar barStyle="light-content" backgroundColor="transparent" translucent />

      {/* Main Gradient Background - Dark Blue to Black */}
      <LinearGradient
        colors={['#0a0e1a', '#1a1a2e', '#16213e', '#0f3460']}
        style={styles.mainGradient}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 1 }}
      />

      {/* Secondary Gradient Overlay - Deep Purple/Blue */}
      <LinearGradient
        colors={['rgba(15,52,96,0.4)', 'rgba(26,26,46,0.6)', 'rgba(10,14,26,0.8)']}
        style={styles.overlayGradient}
        start={{ x: 0.5, y: 0 }}
        end={{ x: 0.5, y: 1 }}
      />

      {/* Shimmer Effect */}
      <Animated.View
        style={[
          styles.shimmerContainer,
          {
            transform: [{ translateX: shimmerTranslate }],
          },
        ]}
      >
        <LinearGradient
          colors={['transparent', 'rgba(255,107,157,0.05)', 'transparent']}
          style={styles.shimmerGradient}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 0 }}
        />
      </Animated.View>

      {/* Floating stars */}
      {stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.floatingStar,
            {
              width: star.size,
              height: star.size,
              top: star.top,
              left: star.left,
              right: star.right,
              bottom: star.bottom,
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -(10 + Math.random() * 15)],
                  }),
                },
                {
                  scale: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8 + Math.random() * 0.2, 1 + Math.random() * 0.3],
                  }),
                },
              ],
              opacity: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.3 + Math.random() * 0.2, 0.7 + Math.random() * 0.3],
              }),
            },
          ]}
        >
          <View style={[styles.starDot, { 
            backgroundColor: index % 2 === 0 ? '#FF6B9D' : '#60A5FA',
            opacity: 0.4 + Math.random() * 0.3,
          }]} />
        </Animated.View>
      ))}

      {/* Floating hearts (subtle) */}
      {hearts.map((heart, index) => (
        <Animated.View
          key={`heart-${index}`}
          style={[
            styles.floatingHeart,
            {
              width: heart.size,
              height: heart.size,
              top: heart.top,
              left: heart.left,
              right: heart.right,
              bottom: heart.bottom,
              transform: [
                {
                  translateY: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, -(15 + Math.random() * 20)],
                  }),
                },
                {
                  scale: floatAnim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0.8 + Math.random() * 0.2, 1 + Math.random() * 0.2],
                  }),
                },
              ],
              opacity: floatAnim.interpolate({
                inputRange: [0, 1],
                outputRange: [0.1 + Math.random() * 0.1, 0.2 + Math.random() * 0.2],
              }),
            },
          ]}
        >
          <Icon name="heart" size={heart.size} color="#FF6B9D" />
        </Animated.View>
      ))}

      {/* Nebula effect */}
      <View style={styles.nebulaContainer}>
        <View style={[styles.nebula, styles.nebula1]} />
        <View style={[styles.nebula, styles.nebula2]} />
        <View style={[styles.nebula, styles.nebula3]} />
      </View>

      {/* Main Content */}
      <Animated.View style={[styles.content, { opacity: fadeAnim, transform: [{ scale: scaleAnim }] }]}>
        {/* Glowing heart with rotation */}
        <Animated.View
          style={[
            styles.heartWrapper,
            {
              transform: [{ scale: heartScale }],
            },
          ]}
        >
          <Animated.View
            style={[
              styles.heartGlow,
              {
                opacity: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [0.2, 0.6],
                }),
                transform: [{ scale: glowAnim.interpolate({
                  inputRange: [0, 1],
                  outputRange: [1, 1.2],
                }) }],
              },
            ]}
          />
          
          <Animated.View
            style={[
              styles.heartRotate,
              {
                transform: [{ rotate: spin }],
              },
            ]}
          >
            <LinearGradient
              colors={['#FF6B9D', '#A855F7', '#3B82F6']}
              style={styles.heartCircle}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 1 }}
            >
              <Icon name="heart" size={45} color="#fff" />
            </LinearGradient>
          </Animated.View>

          {/* Sparkle ring */}
          <View style={styles.sparkleRing}>
            {[...Array(8)].map((_, i) => (
              <Animated.View
                key={i}
                style={[
                  styles.sparkle,
                  {
                    transform: [
                      {
                        rotate: `${(i * 45)}deg`,
                      },
                      {
                        translateY: -65,
                      },
                    ],
                    opacity: glowAnim.interpolate({
                      inputRange: [0, 1],
                      outputRange: [0.1, 0.4],
                    }),
                  },
                ]}
              >
                <Icon name="star" size={6} color="#60A5FA" />
              </Animated.View>
            ))}
          </View>
        </Animated.View>

        {/* Title */}
        <Animated.View style={{ opacity: textFade }}>
          <Text style={styles.title}>
            For Alice 💕
          </Text>
        </Animated.View>

        {/* Subtitle */}
        <Animated.View style={{ opacity: subtitleFade }}>
          <Text style={styles.subtitle}>
            💞
          </Text>
          <View style={styles.dividerContainer}>
            <View style={styles.dividerLine} />
            <Icon name="heart" size={12} color="#FF6B9D" />
            <View style={styles.dividerLine} />
          </View>
          <Text style={styles.subtitleSmall}>
            Every note, every memory, every moment ✨
          </Text>
        </Animated.View>

        {/* Button or Loading */}
        {isFirstLaunch ? (
          <Animated.View style={[styles.buttonContainer, { opacity: buttonFade }]}>
            <TouchableOpacity
              style={styles.enterButton}
              onPress={handleEnterApp}
              activeOpacity={0.8}
            >
              <LinearGradient
                colors={['#FF6B9D', '#A855F7']}
                style={styles.enterButtonGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
              >
                <Text style={styles.enterButtonText}>✨ Enter the Magic</Text>
                <Icon name="arrow-forward" size={18} color="#fff" style={styles.buttonIcon} />
              </LinearGradient>
            </TouchableOpacity>
            
            <View style={styles.bottomTags}>
              <Text style={styles.tagText}>❤️ Made with love</Text>
              <View style={styles.tagDot} />
              <Text style={styles.tagText}>🎵 For Alice</Text>
            </View>
          </Animated.View>
        ) : (
          <Animated.View style={[styles.loadingContainer, { opacity: buttonFade }]}>
            <View style={styles.loadingDots}>
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    transform: [
                      {
                        scale: glowAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1, 1.5, 1],
                        }),
                      },
                    ],
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    transform: [
                      {
                        scale: glowAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [0.8, 1.5, 0.8],
                        }),
                      },
                    ],
                    marginLeft: 8,
                  },
                ]}
              />
              <Animated.View
                style={[
                  styles.loadingDot,
                  {
                    transform: [
                      {
                        scale: glowAnim.interpolate({
                          inputRange: [0, 0.5, 1],
                          outputRange: [1.2, 1, 1.2],
                        }),
                      },
                    ],
                    marginLeft: 8,
                  },
                ]}
              />
            </View>
            <Text style={styles.loadingText}>Loading your magic...</Text>
          </Animated.View>
        )}

        <Text style={styles.versionText}>v1.0.0</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0a0e1a',
  },
  mainGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },
  overlayGradient: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
  },

  // ── Shimmer ──
  shimmerContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    width: width * 2,
    height: '100%',
    zIndex: 2,
  },
  shimmerGradient: {
    width: '100%',
    height: '100%',
  },

  // ── Nebula ──
  nebulaContainer: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    zIndex: 1,
    overflow: 'hidden',
  },
  nebula: {
    position: 'absolute',
    borderRadius: 200,
    opacity: 0.15,
  },
  nebula1: {
    width: 300,
    height: 300,
    top: -100,
    right: -100,
    backgroundColor: '#A855F7',
  },
  nebula2: {
    width: 250,
    height: 250,
    bottom: -50,
    left: -100,
    backgroundColor: '#3B82F6',
  },
  nebula3: {
    width: 200,
    height: 200,
    top: '50%',
    right: '30%',
    backgroundColor: '#FF6B9D',
  },

  content: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 30,
    zIndex: 10,
  },

  // ── Heart ──
  heartWrapper: {
    width: 120,
    height: 120,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 30,
  },
  heartGlow: {
    position: 'absolute',
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(255,107,157,0.15)',
  },
  heartRotate: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
  },
  heartCircle: {
    width: 90,
    height: 90,
    borderRadius: 45,
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 30,
    elevation: 10,
  },
  sparkleRing: {
    position: 'absolute',
    width: 150,
    height: 150,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sparkle: {
    position: 'absolute',
  },

  // ── Text ──
  title: {
    fontSize: 40,
    fontWeight: '800',
    color: '#fff',
    textAlign: 'center',
    marginBottom: 12,
    letterSpacing: 1,
    textShadowColor: 'rgba(0,0,0,0.3)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  subtitle: {
    fontSize: 17,
    color: 'rgba(255, 255, 255, 0.8)',
    textAlign: 'center',
    marginBottom: 12,
    fontWeight: '400',
    letterSpacing: 0.5,
  },
  subtitleSmall: {
    fontSize: 13,
    color: 'rgba(255, 255, 255, 0.5)',
    textAlign: 'center',
    marginTop: 8,
  },
  dividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginVertical: 8,
  },
  dividerLine: {
    width: 30,
    height: 1,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },

  // ── Button ──
  buttonContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  enterButton: {
    borderRadius: 30,
    shadowColor: '#FF6B9D',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 20,
    elevation: 8,
    overflow: 'hidden',
  },
  enterButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 30,
    paddingVertical: 15,
  },
  enterButtonText: {
    fontSize: 17,
    fontWeight: '700',
    color: '#fff',
    marginRight: 8,
  },
  buttonIcon: {
    marginLeft: 4,
  },

  // ── Loading ──
  loadingContainer: {
    alignItems: 'center',
    marginTop: 30,
  },
  loadingDots: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 12,
  },
  loadingDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FF6B9D',
  },
  loadingText: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.6)',
    marginTop: 4,
  },

  // ── Bottom ──
  versionText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.25)',
    marginTop: 30,
    letterSpacing: 2,
  },
  bottomTags: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 16,
  },
  tagText: {
    fontSize: 11,
    color: 'rgba(255, 255, 255, 0.3)',
  },
  tagDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: 'rgba(255,255,255,0.2)',
    marginHorizontal: 8,
  },

  // ── Floating Elements ──
  floatingHeart: {
    position: 'absolute',
    opacity: 0.3,
  },
  floatingStar: {
    position: 'absolute',
    borderRadius: 2,
  },
  starDot: {
    width: '100%',
    height: '100%',
    borderRadius: 2,
  },
});
