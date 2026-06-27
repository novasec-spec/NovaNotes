// hooks/useSync.ts
import { useState, useEffect, useCallback } from 'react';
import { SyncStatus } from '../types';
import { syncManager } from '../services/syncManager';
import { Note } from '../types';

export function useSync(notes: Note[], onUpdate: (updated: Note[]) => void) {
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('idle');
  const [lastBackup, setLastBackup] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    const unsubscribe = syncManager.subscribe((status, backup) => {
      setSyncStatus(status);
      setLastBackup(backup);
    });

    return unsubscribe;
  }, []);

  const sync = useCallback(async () => {
    await syncManager.run(notes, onUpdate);
  }, [notes, onUpdate]);

  const refresh = useCallback(async () => {
    setRefreshing(true);
    await sync();
    setRefreshing(false);
  }, [sync]);

  const restore = useCallback(async () => {
    return await syncManager.restoreFromCloud();
  }, []);

  return {
    syncStatus,
    lastBackup,
    refreshing,
    sync,
    refresh,
    restore,
  };
}
