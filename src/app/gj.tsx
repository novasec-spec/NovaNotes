import React, { useEffect, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  StyleSheet,
  Pressable,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

export default function AsyncStorageInspector() {
  const [storageData, setStorageData] = useState<Record<string, string | null>>(
    {}
  );

  const loadStorage = async () => {
    try {
      const keys = await AsyncStorage.getAllKeys();
      const items = await AsyncStorage.multiGet(keys);

      console.log('========== AsyncStorage ==========');
      console.log('Keys:', keys);
      console.log('Items:', items);

      const data = Object.fromEntries(items);

      console.log('As Object:');
      console.log(data);
      console.log('==================================');

      setStorageData(data);
    } catch (error) {
      console.error('Failed to load AsyncStorage:', error);
    }
  };

  useEffect(() => {
    loadStorage();
  }, []);

  return (
    <View style={styles.container}>
      <Pressable style={styles.button} onPress={loadStorage}>
        <Text style={styles.buttonText}>Refresh Storage</Text>
      </Pressable>

      <ScrollView contentContainerStyle={styles.content}>
        {Object.keys(storageData).length === 0 ? (
          <Text style={styles.empty}>No AsyncStorage items found.</Text>
        ) : (
          Object.entries(storageData).map(([key, value]) => (
            <View key={key} style={styles.card}>
              <Text style={styles.key}>{key}</Text>
              <Text style={styles.value}>{value}</Text>
            </View>
          ))
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#111',
  },
  button: {
    margin: 16,
    padding: 14,
    backgroundColor: '#3b82f6',
    borderRadius: 10,
    alignItems: 'center',
  },
  buttonText: {
    color: '#fff',
    fontWeight: 'bold',
  },
  content: {
    padding: 16,
  },
  card: {
    backgroundColor: '#1e1e1e',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  key: {
    color: '#4ade80',
    fontWeight: 'bold',
    marginBottom: 6,
  },
  value: {
    color: '#fff',
  },
  empty: {
    color: '#aaa',
    textAlign: 'center',
    marginTop: 40,
  },
});
