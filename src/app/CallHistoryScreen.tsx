// src/app/CallHistoryScreen.tsx
// Route '/CallHistoryScreen'

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, Image, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import Icon from 'react-native-vector-icons/Ionicons';
import CallService, { Call } from '../services/CallService';
import { supabase } from '../config/supabase'; // to know "my" id for direction/other-party display
import { readCache, writeCache } from '../utils/screenCache';

const CALL_HISTORY_CACHE_KEY = 'call_history';

interface HistoryRow extends Call {
  caller?: { id: string; username: string; avatar_url?: string };
  callee?: { id: string; username: string; avatar_url?: string };
}

export default function CallHistoryScreen() {
  const [rows, setRows] = useState<HistoryRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [myId, setMyId] = useState<string | null>(null);

  const [showingStaleCache, setShowingStaleCache] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await supabase.auth.getUser();
      setMyId(data?.user?.id ?? null);
      const history = await CallService.getCallHistory(100);
      setRows(history as HistoryRow[]);
      setShowingStaleCache(false);
      await writeCache(CALL_HISTORY_CACHE_KEY, history);
    } catch (error) {
      // ⚠️ FIX: this used to have no try/catch at all — if either await
      // above threw, `setLoading(false)`/`setRefreshing(false)` below
      // never ran, and the screen was stuck on the spinner forever with
      // no visible error (same failure mode the home screen had). Now it
      // always reaches `finally`, and falls back to whatever's already on
      // screen (cache or a prior successful load) instead of a blank list.
      console.error('Failed to load call history:', error);
      setShowingStaleCache(rows.length > 0);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [rows.length]);

  // Cache-first hydrate: show the last-known call history instantly on
  // mount (no spinner, no blank list) while `load()` still runs right
  // after to fetch the freshest data from the network.
  const hydratedRef = useRef(false);
  useEffect(() => {
    if (hydratedRef.current) return;
    hydratedRef.current = true;

    (async () => {
      const cached = await readCache<HistoryRow[]>(CALL_HISTORY_CACHE_KEY);
      if (cached?.data?.length) {
        setRows(cached.data);
        setLoading(false);
      }
      load();
    })();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const [callingId, setCallingId] = useState<string | null>(null); // guards double-tap while initiateCall is in flight

  const startCall = async (otherUserId: string, otherUserName: string, otherUserAvatar: string, type: 'audio' | 'video') => {
    if (callingId) return;
    setCallingId(otherUserId);

    const call = await CallService.initiateCall(otherUserId, type);

    setCallingId(null);

    if (!call) {
      // Surface this to the user — e.g. a toast/Alert. Kept silent here
      // since UI feedback conventions vary by app; don't skip this in production.
      console.warn('⚠️ Failed to start call from history');
      return;
    }

    router.push({
      pathname: '/CallingScreen',
      params: { callId: call.id, otherUserId, otherUserName, otherUserAvatar, type },
    });
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.centered}>
          <ActivityIndicator size="large" color="#FF6B9D" />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <Text style={styles.headerTitle}>Call History</Text>
        {showingStaleCache && (
          <View style={styles.staleRow}>
            <Icon name="cloud-offline-outline" size={13} color="#999" />
            <Text style={styles.staleText}>Couldn't refresh — showing saved results</Text>
          </View>
        )}
      </View>

      <FlatList
        data={rows}
        keyExtractor={(item) => item.id}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6B9D" />}
        ListEmptyComponent={
          <View style={styles.centered}>
            <Icon name="call-outline" size={48} color="#666" />
            <Text style={styles.emptyText}>No calls yet</Text>
          </View>
        }
        renderItem={({ item }) => {
          const isOutgoing = item.caller_id === myId;
          const other = isOutgoing ? item.callee : item.caller;
          const isMissed = !isOutgoing && ['missed', 'declined'].includes(item.status);
          const otherName = other?.username || 'Unknown';
          const otherAvatar = other?.avatar_url || '';

          return (
            <TouchableOpacity
              style={styles.row}
              onPress={() => other && startCall(other.id, otherName, otherAvatar, item.type)}
            >
              {otherAvatar ? (
                <Image source={{ uri: otherAvatar }} style={styles.avatar} />
              ) : (
                <View style={[styles.avatarFallback, { backgroundColor: '#FF6B9D' }]}>
                  <Text style={styles.avatarText}>{otherName.charAt(0).toUpperCase()}</Text>
                </View>
              )}

              <View style={styles.rowInfo}>
                <Text style={[styles.rowName, isMissed && styles.missedText]}>{otherName}</Text>
                <View style={styles.rowMeta}>
                  <Icon
                    name={isOutgoing ? 'arrow-up-outline' : isMissed ? 'call-missed' : 'arrow-down-outline'}
                    size={14}
                    color={isMissed ? '#EF4444' : '#999'}
                  />
                  <Text style={[styles.rowMetaText, isMissed && styles.missedText]}>
                    {' '}
                    {formatWhen(item.created_at)} · {item.duration ? formatDuration(item.duration) : item.status}
                  </Text>
                </View>
              </View>

              <Icon name={item.type === 'video' ? 'videocam' : 'call'} size={22} color="#FF6B9D" />
            </TouchableOpacity>
          );
        }}
      />
    </SafeAreaView>
  );
}

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

function formatWhen(iso?: string): string {
  if (!iso) return '';
  const date = new Date(iso);
  const now = new Date();
  const isToday = date.toDateString() === now.toDateString();
  if (isToday) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#1A1A2E' },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80 },
  emptyText: { color: '#999', marginTop: 12, fontSize: 15 },
  header: { paddingHorizontal: 20, paddingVertical: 16, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#333' },
  headerTitle: { fontSize: 22, fontWeight: '700', color: '#fff' },
  staleRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 6 },
  staleText: { fontSize: 11, color: '#999', fontWeight: '500' },
  row: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 20, paddingVertical: 14, gap: 12 },
  avatar: { width: 48, height: 48, borderRadius: 24 },
  avatarFallback: { width: 48, height: 48, borderRadius: 24, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 18, fontWeight: '700', color: '#fff' },
  rowInfo: { flex: 1 },
  rowName: { fontSize: 16, fontWeight: '600', color: '#fff', marginBottom: 2 },
  rowMeta: { flexDirection: 'row', alignItems: 'center' },
  rowMetaText: { fontSize: 13, color: '#999' },
  missedText: { color: '#EF4444' },
});
