// src/app/chat/index.tsx - PROFESSIONALLY UPDATED
import React, { useState, useEffect, useRef } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  ActivityIndicator, 
  TouchableOpacity, 
  Alert,
  StatusBar,
  Animated,
} from 'react-native';
import { router } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useTheme } from '../../../contexts/ThemeContext';
import Icon from 'react-native-vector-icons/Ionicons';
import MCIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import AuthScreen from './auth';
import ChatList from './chatlist';
import ChatRoom from './chatroom';
import { User } from './types';
import { SafeAreaView } from 'react-native-safe-area-context';
import { setupNotifications, addNotificationListeners, registerPushToken } from './notification';
import { supabase } from '../../../config/supabase';

export default function ChatScreen() {
  const { colors, isDarkMode } = useTheme();
  const [user, setUser] = useState<User | null>(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [unreadCount, setUnreadCount] = useState(0);
  const [notificationCount, setNotificationCount] = useState(0);
  
  // Animation for notification badge
  const badgeScale = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    initializeChat();
    setupNotificationListeners();
    loadUnreadCount();
    
    // Subscribe to new messages for real-time badge update
    const subscription = supabase
      .channel('chat_badge')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
        },
        () => {
          loadUnreadCount();
          animateBadge();
        }
      )
      .subscribe();

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  const initializeChat = async () => {
    await checkAuth();
    await setupNotifications();
  };

  const setupNotificationListeners = () => {
    const cleanup = addNotificationListeners((data) => {
      console.log('📨 Notification tapped:', data);
      if (data.senderId) {
        // Navigate to chat with that user
        // You can implement navigation here
      }
    });
    return cleanup;
  };

  const loadUnreadCount = async () => {
    try {
      const userData = await AsyncStorage.getItem('chat_user');
      if (!userData) return;
      
      const user = JSON.parse(userData);
      
      // Get unread messages count
      const { count, error } = await supabase
        .from('messages')
        .select('*', { count: 'exact', head: true })
        .neq('sender_id', user.id)
        .is('read_at', null);

      if (!error && count !== null) {
        setUnreadCount(count);
        setNotificationCount(count);
      }
    } catch (error) {
      console.error('Error loading unread count:', error);
    }
  };

  const animateBadge = () => {
    Animated.sequence([
      Animated.spring(badgeScale, {
        toValue: 1.4,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
      Animated.spring(badgeScale, {
        toValue: 1,
        friction: 3,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  };

  const checkAuth = async () => {
    try {
      const auth = await AsyncStorage.getItem('is_authenticated');
      const userData = await AsyncStorage.getItem('chat_user');
      
      if (auth === 'true' && userData) {
        const parsedUser = JSON.parse(userData);
        setUser(parsedUser);
        setIsAuthenticated(true);
        
        // Register push token for this user
        await registerPushToken(parsedUser.id);
      }
    } catch (error) {
      console.error('Error checking auth:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (loggedInUser: User) => {
    setUser(loggedInUser);
    setIsAuthenticated(true);
    await registerPushToken(loggedInUser.id);
    await loadUnreadCount();
  };

  const handleLogout = async () => {
    Alert.alert(
      'Logout',
      'Are you sure you want to logout?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Logout',
          style: 'destructive',
          onPress: async () => {
            await AsyncStorage.removeItem('is_authenticated');
            await AsyncStorage.removeItem('chat_user');
            await supabase.auth.signOut();
            setUser(null);
            setIsAuthenticated(false);
            setSelectedUser(null);
            setUnreadCount(0);
          },
        },
      ]
    );
  };

  const navigateToNotifications = () => {
    router.push('/chat/notifications');
  };

  const navigateToSettings = () => {
    router.push('/chat/settings');
  };


  const navigateToCalls = () => {
    router.push('/CallHistoryScreen');
  };

  // ─── Render Loading ──────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={[styles.centerContainer, { backgroundColor: colors.background }]}>
        <ActivityIndicator size="large" color="#FF6B9D" />
        <Text style={[styles.loadingText, { color: colors.muted }]}>
          Loading your chats...
        </Text>
      </View>
    );
  }

  // ─── Render Auth ─────────────────────────────────────────────────────────
  if (!isAuthenticated) {
    return <AuthScreen />;
  }

  // ─── Render Chat Room ────────────────────────────────────────────────────
  if (selectedUser && user) {
    return (
      <ChatRoom
        user={user}
        otherUser={selectedUser}
        onBack={() => setSelectedUser(null)}
      />
    );
  }

  // ─── Render Main Chat List ──────────────────────────────────────────────
  return (
    <SafeAreaView style={[styles.container, { backgroundColor: colors.background }]} edges={['top']}>
      <StatusBar barStyle={isDarkMode ? 'light-content' : 'dark-content'} />
      
      {/* ─── Header ─── */}
      <View style={[styles.header, { backgroundColor: colors.card, borderBottomColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <View style={styles.headerIconContainer}>
            <Icon name="chatbubbles" size={24} color="#FF6B9D" />
          </View>
          <View>
            <Text style={[styles.title, { color: colors.text }]}>Chats</Text>
            <Text style={[styles.subtitle, { color: colors.muted }]}>
              {unreadCount > 0 
                ? `${unreadCount} unread message${unreadCount > 1 ? 's' : ''}` 
                : 'All caught up ✨'}
            </Text>
          </View>
        </View>

        <View style={styles.headerRight}>
          {/* ─── Notification Button with Badge ─── */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F5F3F7' }]}
            onPress={navigateToNotifications}
            activeOpacity={0.7}
          >
            <Icon name="notifications-outline" size={22} color={colors.text} />
            {notificationCount > 0 && (
              <Animated.View 
                style={[
                  styles.badge, 
                  { 
                    backgroundColor: '#EF4444',
                    transform: [{ scale: badgeScale }],
                  }
                ]}
              >
                <Text style={styles.badgeText}>
                  {notificationCount > 99 ? '99+' : notificationCount}
                </Text>
              </Animated.View>
            )}
          </TouchableOpacity>

          {/* ─── New Chat Button ─── */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F5F3F7' }]}
            onPress={() => router.push('/chat/users')}
            activeOpacity={0.7}
          >
            <Icon name="add-circle-outline" size={22} color={colors.text} />
          </TouchableOpacity>
           <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F5F3F7' }]}
            onPress={navigateToCalls}
            activeOpacity={0.7}
          >
            <Icon name="call-outline" size={22} color={colors.text} />
          </TouchableOpacity>

          {/* ─── Settings Button ─── */}
          <TouchableOpacity
            style={[styles.iconButton, { backgroundColor: isDarkMode ? '#1A1A2E' : '#F5F3F7' }]}
            onPress={navigateToSettings}
            activeOpacity={0.7}
          >
            <Icon name="settings-outline" size={22} color={colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* ─── Online Status Banner ─── */}
      {user && (
        <View style={[styles.statusBanner, { backgroundColor: colors.card }]}>
          <View style={[styles.statusDot, { backgroundColor: '#4CAF50' }]} />
          <Text style={[styles.statusText, { color: colors.muted }]}>
            Online — {user.username}
          </Text>
        </View>
      )}

      {/* ─── Chat List ─── */}
      <ChatList user={user!} onSelectUser={setSelectedUser} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  centerContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    fontWeight: '500',
  },

  // ─── Header ───
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerIconContainer: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#FF6B9D20',
    alignItems: 'center',
    justifyContent: 'center',
  },
  title: {
    fontSize: 20,
    fontWeight: '700',
  },
  subtitle: {
    fontSize: 12,
    opacity: 0.7,
  },

  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  iconButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },

  // ─── Badge ───
  badge: {
    position: 'absolute',
    top: -4,
    right: -4,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    borderWidth: 2,
    borderColor: '#FFFFFF',
  },
  badgeText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  // ─── Status Banner ───
  statusBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 8,
    gap: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.05)',
  },
  statusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  statusText: {
    fontSize: 12,
    fontWeight: '500',
  },
});
