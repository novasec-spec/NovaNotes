// app/call.tsx
import React, { useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, SafeAreaView, Alert, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { useCall } from '../contexts/CallContext';
import * as Haptics from 'expo-haptics';
import Constants from 'expo-constants';

export default function CallScreen() {
  const { state, nativeModulesAvailable, isVideo, endCall } = useCall();
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!nativeModulesAvailable) {
      Alert.alert(
        'Build Required',
        'Video calling requires a built version of the app. Please build and install the app.',
        [{ text: 'Go Back', onPress: () => router.back() }]
      );
    }
    setLoading(false);
  }, [nativeModulesAvailable]);

  // Lazy load call UI components only when native modules are available
  const renderCallUI = () => {
    if (!nativeModulesAvailable) {
      return (
        <View style={styles.fallbackContainer}>
          <Ionicons name="construct-outline" size={60} color="#666" />
          <Text style={styles.fallbackTitle}>Native Modules Required</Text>
          <Text style={styles.fallbackText}>
            This feature requires a built version of the app.
          </Text>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Text style={styles.backButtonText}>Go Back</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // Import call components dynamically
    const CallUI = React.lazy(() => import('../components/CallUI'));
    return <CallUI />;
  };

  if (loading) {
    return (
      <View style={styles.loadingContainer}>
        <Text>Loading call...</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <React.Suspense fallback={<Text>Loading call interface...</Text>}>
        {renderCallUI()}
      </React.Suspense>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#000' },
  loadingContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#000' },
  fallbackContainer: { flex: 1, justifyContent: 'center', alignItems: 'center', backgroundColor: '#f5f5f5', padding: 20 },
  fallbackTitle: { fontSize: 20, fontWeight: '700', marginTop: 16, color: '#111' },
  fallbackText: { fontSize: 14, color: '#666', textAlign: 'center', marginTop: 8, marginBottom: 24 },
  backButton: { backgroundColor: '#007AFF', paddingHorizontal: 24, paddingVertical: 12, borderRadius: 8 },
  backButtonText: { color: '#fff', fontSize: 16, fontWeight: '600' },
});
