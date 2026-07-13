// src/hooks/useIncomingCallListener.ts
import { useEffect, useRef } from 'react';
import { router, useRootNavigationState } from 'expo-router';
import { supabase } from '../config/supabase';
import CallService, { Call } from '../services/CallService';
import { safePush } from '../utils/navigation';

export function useIncomingCallListener(userId?: string) {
  const activeCallIdRef = useRef<string | null>(null);
  const rootNavigationState = useRootNavigationState();

  useEffect(() => {
    if (!userId) return;

    const channel = supabase
      .channel(`incoming-calls-${userId}`)

      // New incoming calls
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${userId}`,
        },
        async (payload) => {
          try {
            const call = payload.new as Call;

            // Ignore anything except active ringing calls
            if (call.status !== 'ringing') return;

            // Prevent multiple incoming screens
            if (activeCallIdRef.current) return;

            // Wait until Expo Router is ready
            if (!rootNavigationState?.key) {
              console.warn('⚠️ Navigation not ready yet');
              return;
            }

            activeCallIdRef.current = call.id;

            const caller = await CallService.getOtherUser(call.id);

            safePush({
              pathname: '/IncomingCallScreen',
              params: {
                callId: call.id,
                callerId: call.caller_id,
                callerName: caller?.username ?? 'Unknown',
                callerAvatar: caller?.avatar_url ?? '',
                type: call.type,
              },
            });
          } catch (err) {
            console.error('❌ Incoming call listener error:', err);
            activeCallIdRef.current = null;
          }
        }
      )

      // Reset active call when call ends
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'calls',
          filter: `callee_id=eq.${userId}`,
        },
        (payload) => {
          const call = payload.new as Call;

          if (
            ['ended', 'declined', 'cancelled', 'missed'].includes(
              call.status
            )
          ) {
            if (activeCallIdRef.current === call.id) {
              activeCallIdRef.current = null;
            }
          }
        }
      )

      .subscribe((status) => {
        console.log(
          `📞 Incoming call listener status: ${status}`
        );

        if (
          status === 'CHANNEL_ERROR' ||
          status === 'TIMED_OUT'
        ) {
          console.warn(
            '⚠️ Incoming-call listener subscription failed:',
            status
          );
        }
      });

    return () => {
      activeCallIdRef.current = null;
      supabase.removeChannel(channel);
    };
  }, [userId, rootNavigationState?.key]);
}
