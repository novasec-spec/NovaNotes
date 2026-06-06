
import React, { useEffect, useState, useRef } from 'react';  import { NavigationContainer } from 
'@react-navigation/native'; import { createBottomTabNavigator } from 
'@react-navigation/bottom-tabs'; import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } 
from 'react-native-safe-area-context'; import Icon from 'react-native-vector-icons/Ionicons'; 
import { TouchableOpacity, Alert } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage'; import { 
NotificationService } from '../services/notificationService'; import { SupabaseBackup } from 
'../services/supabaseBackup';

import HomeScreen from './screens/HomeScreen';
import NotesScreen from './screens/NotesScreen';
import MemoriesScreen from './screens/MemoriesScreen';
import VibeScreen from './screens/VibeScreen';
import SecretVaultScreen from './screens/SecretVaultScreen';
import TokenManagerScreen from  './screens/TokenManagerScreen';
import { testConnection } from '../utils/test';

const Tab = createBottomTabNavigator();
const notificationService = new NotificationService();
const backup = new SupabaseBackup('Njeri');
const USER_ID = 'Alice'; 

export default function App() {
  const [isSecretVisible, setIsSecretVisible] = useState(false);
  const tapCount = useRef(0);
  const tapTimer = useRef(null); 
  const notificationService = new NotificationService(USER_ID);
  const backup = new SupabaseBackup(USER_ID);

  useEffect(() => {
    setupApp();
    checkSecretAccess();
  }, []);

  const setupApp = async () => {
    // Setup notifications (automatically saves token to Supabase)
    await notificationService.setupNotifications();
    
    // Schedule daily love messages
    await notificationService.scheduleDailyLoveMessage();
    
    // Add notification listeners
    const cleanup = notificationService.addNotificationListeners();
    
    // Restore backup if first launch
    const hasRestored = await AsyncStorage.getItem('hasRestored');
    if (!hasRestored) {
      await backup.restoreFromBackup();
      await AsyncStorage.setItem('hasRestored', 'true');
    }
    
    return cleanup;
  };

  const checkSecretAccess = async () => {
    // Only you know this secret key
    const hasAccess = await AsyncStorage.getItem('dev_access');
    if (hasAccess === 'true') {
      setIsSecretVisible(true);
    }
  };

 // Secret gesture handler (5 taps on any screen)
  const handleSecretTap = () => {
    tapCount.current++;
    if (tapTimer.current) clearTimeout(tapTimer.current);

    tapTimer.current = setTimeout(async () => {
      if (tapCount.current === 5) {
        const currentAccess = await AsyncStorage.getItem('dev_access');
        if (currentAccess === 'true') {
          // Already have access
          Alert.alert('🔧 Dev Mode', 'Already in developer mode');
        } else {
          // Grant access
          await AsyncStorage.setItem('dev_access', 'true');
          setIsSecretVisible(true);
          Alert.alert('🔓 Developer Mode Unlocked', 'Secret tools are now available');
        }
        tapCount.current = 0;
      } else {
        tapCount.current = 0;
      }
    }, 800);
  };
  // Rest of your App component stays the same...

return (
  <SafeAreaProvider>
    <TouchableOpacity
      style={{ flex: 1 }}
      onPress={handleSecretTap}
      activeOpacity={1}
    >
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Home: focused ? 'heart' : 'heart-outline',
              Notes: focused ? 'document-text' : 'document-text-outline',
              Memories: focused ? 'images' : 'images-outline',
              Vibe: focused ? 'happy' : 'happy-outline',
              Vault: focused ? 'lock-closed' : 'lock-closed-outline',
              TokenManager: 'construct-outline',
            };

            return (
              <Icon
                name={icons[route.name]}
                size={size}
                color={color}
              />
            );
          },
          tabBarActiveTintColor: '#FF6B9D',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: {
            backgroundColor: '#fff',
            borderTopWidth: 0,
            elevation: 10,
          },
          headerStyle: { backgroundColor: 'pink' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        })}
      >
        <Tab.Screen
          name="Home"
          component={HomeScreen}
          options={{ title: 'Home' }}
        />

        <Tab.Screen
          name="Notes"
          component={NotesScreen}
          options={{ title: 'Take Notes' }}
        />

        <Tab.Screen
          name="Memories"
          component={MemoriesScreen}
          options={{ title: 'Memories' }}
        />

        <Tab.Screen
          name="Vibe"
          component={VibeScreen}
          options={{ title: "Today's Vibe" }}
        />

        <Tab.Screen
          name="Vault"
          component={SecretVaultScreen}
          options={{ title: 'Secret Vault' }}
        />

        {isSecretVisible && (
          <Tab.Screen
            name="TokenManager"
            component={TokenManagerScreen}
            options={{ title: '🔧 Dev Tools' }}
          />
        )}
      </Tab.Navigator>
    </TouchableOpacity>
  </SafeAreaProvider>
);
}
