// app/calls.tsx
import React, { useEffect, useState, useCallback } from 'react';
import { View, Text, FlatList, TouchableOpacity, StyleSheet, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { formatDistanceToNow } from 'date-fns';
import * as Haptics from 'expo-haptics';
import { supabase } from '../config/supabase';
import { useCall } from '../contexts/CallContext';

interface CallLog {
  id: string;
  call_id: string;
  caller_id: string;
  callee_id: string;
  video: boolean;
  status: 'missed' | 'completed' | 'declined';
  duration_seconds: number | null;
  created_at: string;
  other_user_name?: string;
}

export default function CallsScreen() {
  const { startCall, nativeModulesAvailable } = useCall();
  const [logs, setLogs] = useState<CallLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);

  const fetchLogs = useCallback(async () => {
    const { data: session } = await supabase.auth.getSession();
    const uid = session.session?.user.id;
    if (!uid) return;
    setUserId(uid);

    const { data, error } = await supabase
      .from('call_logs')
      .select(`
        id, call_id, caller_id, callee_id, video, status, duration_seconds, created_at,
        caller:profiles!call_logs_caller_id_fkey(name),
        callee:profiles!call_logs_callee_id_fkey(name)
      `)
      .or(`caller_id.eq.${uid},callee_id.eq.${uid}`)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) {
      console.error('Error fetching call logs:', error);
      setLoading(false);
      return;
    }

    const mapped = (data || []).map((row: any) => ({
      ...row,
      other_user_name: row.caller_id === uid ? row.callee?.name : row.caller?.name,
    }));

    setLogs(mapped);
    setLoading(false);
  }, []);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchLogs();
    setRefreshing(false);
  };

  const formatDuration = (s: number | null) => {
    if (!s) return null;
    const m = Math.floor(s / 60);
    const sec = s % 60;
    return `${m}:${sec.toString().padStart(2, '0')}`;
  };

  const handleCallPress = (item: CallLog) => {
    if (!nativeModulesAvailable) {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
      return;
    }
    
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    const targetId = item.caller_id === userId ? item.callee_id : item.caller_id;
    startCall(targetId, item.other_user_name || 'Unknown', item.video);
  };

  const renderItem = ({ item }: { item: CallLog }) => {
    const isOutgoing = item.caller_id === userId;
    const isMissed = item.status === 'missed' && !isOutgoing;

    const iconName = item.video ? 'videocam' : 'call';
    const directionIcon = isOutgoing ? 'arrow-up-outline' : 'arrow-down-outline';
    const iconColor = isMissed ? '#e53935' : isOutgoing ? '#43a047' : '#666';

    return (
      <TouchableOpacity
        style={styles.row}
        onPress={() => handleCallPress(item)}
        disabled={!nativeModulesAvailable}
      >
        <View style={[styles.iconCircle, isMissed && styles.iconCircleMissed]}>
          <Ionicons name={iconName} size={20} color={iconColor} />
        </View>

        <View style={styles.info}>
          <Text style={[styles.name, isMissed && styles.missedText]}>
            {item.other_user_name || 'Unknown'}
          </Text>
          <View style={styles.metaRow}>
            <Ionicons name={directionIcon} size={13} color={isMissed ? '#e53935' : '#999'} />
            <Text style={[styles.meta, isMissed && styles.missedText]}>
              {isMissed ? 'Missed' : item.status === 'declined' ? 'Declined' : formatDuration(item.duration_seconds) || 'Connected'}
            </Text>
            <Text style={styles.dot}>·</Text>
            <Text style={styles.meta}>
              {formatDistanceToNow(new Date(item.created_at), { addSuffix: true })}
            </Text>
          </View>
        </View>

        <TouchableOpacity
          hitSlop={12}
          onPress={() => handleCallPress(item)}
          disabled={!nativeModulesAvailable}
        >
          <Ionicons name={item.video ? 'videocam-outline' : 'call-outline'} size={22} color={nativeModulesAvailable ? '#43a047' : '#ccc'} />
        </TouchableOpacity>
      </TouchableOpacity>
    );
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <Text style={styles.emptyText}>Loading…</Text>
      </View>
    );
  }

  return (
    <FlatList
      data={logs}
      keyExtractor={(item) => item.id}
      renderItem={renderItem}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
      ListEmptyComponent={
        <View style={styles.center}>
          <Ionicons name="call-outline" size={40} color="#ccc" />
          <Text style={styles.emptyText}>No calls yet</Text>
        </View>
      }
      contentContainerStyle={logs.length === 0 ? { flex: 1 } : undefined}
    />
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 16, paddingVertical: 12,
    borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: '#eee',
  },
  iconCircle: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: '#f2f2f2', justifyContent: 'center', alignItems: 'center',
    marginRight: 12,
  },
  iconCircleMissed: { backgroundColor: '#fdecea' },
  info: { flex: 1 },
  name: { fontSize: 16, fontWeight: '600', color: '#111' },
  missedText: { color: '#e53935' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 2 },
  meta: { fontSize: 13, color: '#999' },
  dot: { color: '#ccc', fontSize: 13 },
  center: { flex: 1, justifyContent: 'center', alignItems: 'center', paddingTop: 100 },
  emptyText: { color: '#999', marginTop: 8, fontSize: 14 },
});
