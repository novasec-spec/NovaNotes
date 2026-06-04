
import React, { useEffect } from 'react'; import { NavigationContainer } from 
'@react-navigation/native'; import { createBottomTabNavigator } from 
'@react-navigation/bottom-tabs'; import { SafeAreaProvider, SafeAreaView, useSafeAreaInsets } 
from 'react-native-safe-area-context'; import Icon from 'react-native-vector-icons/Ionicons'; 
import AsyncStorage from '@react-native-async-storage/async-storage'; import { 
NotificationService } from '../services/notificationService'; import { SupabaseBackup } from 
'../services/supabaseBackup';

import HomeScreen from './screens/HomeScreen';
import NotesScreen from './screens/NotesScreen';
import MemoriesScreen from './screens/MemoriesScreen';
import VibeScreen from './screens/VibeScreen';
import SecretVaultScreen from './screens/SecretVaultScreen';
import Info from './screens/Info.tsx';
import { testConnection } from '../utils/test';

const Tab = createBottomTabNavigator();
const notificationService = new NotificationService();
const backup = new SupabaseBackup('Njeri');
const USER_ID = 'Alice'; 

export default function App() {
  const notificationService = new NotificationService(USER_ID);
  const backup = new SupabaseBackup(USER_ID);

  useEffect(() => {
    setupApp();
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


  // Rest of your App component stays the same...

  return (
    <SafeAreaProvider>
      <Tab.Navigator
        screenOptions={({ route }) => ({
          tabBarIcon: ({ focused, color, size }) => {
            const icons = {
              Home: focused ? 'heart' : 'heart-outline',
              Notes: focused ? 'document-text' : 'document-text-outline',
              Memories: focused ? 'images' : 'images-outline',
              Vibe: focused ? 'happy' : 'happy-outline',
              Vault: focused ? 'lock-closed' : 'lock-closed-outline'
            };
            return <Icon name={icons[route.name]} size={size} color={color} />;
          },
          tabBarActiveTintColor: '#FF6B9D',
          tabBarInactiveTintColor: '#888',
          tabBarStyle: { backgroundColor: '#fff', borderTopWidth: 0, elevation: 10 },
          headerStyle: { backgroundColor: 'pink' },
          headerTintColor: '#fff',
          headerTitleStyle: { fontWeight: '600' },
        })}
      >
        <Tab.Screen name="Home" component={HomeScreen} options={{ title: 'Home' }} />
        <Tab.Screen name="Notes" component={NotesScreen} options={{ title: ' Take Notes' }} />
        <Tab.Screen name="Memories" component={MemoriesScreen} options={{ title: '  Memories' }} />
        <Tab.Screen name="Vibe" component={VibeScreen} options={{ title: ' Today\'s Vibe' }} />
        <Tab.Screen name="Vault" component={SecretVaultScreen} options={{ title: ' Secret Vault' }} />
      </Tab.Navigator>
</SafeAreaProvider>
  );
}
