// supabase/functions/calls-initiate/index.ts
import { serve } from 'https://deno.land/std@0.177.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.38.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    // Get caller info
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { calleeId, type = 'video' } = await req.json()

    if (!calleeId) {
      return new Response(
        JSON.stringify({ error: 'Callee ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get caller and callee info
    const { data: users, error: usersError } = await supabaseClient
      .from('users')
      .select('id, username, avatar_url')
      .in('id', [user.id, calleeId])

    if (usersError) throw usersError

    const caller = users?.find(u => u.id === user.id)
    const callee = users?.find(u => u.id === calleeId)

    if (!callee) {
      return new Response(
        JSON.stringify({ error: 'Callee not found' }),
        { status: 404, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Create call record
    const roomName = `call_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`
    
    const { data: call, error: callError } = await supabaseClient
      .from('calls')
      .insert({
        caller_id: user.id,
        callee_id: calleeId,
        status: 'ringing',
        room_name: roomName,
        started_at: new Date().toISOString(),
      })
      .select()
      .single()

    if (callError) throw callError

    // Get callee's push token
    const { data: tokenData } = await supabaseClient
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', calleeId)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()

    // Send push notification to callee
    if (tokenData?.expo_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: tokenData.expo_token,
          title: `📞 Incoming call from ${caller?.username || 'Someone'}`,
          body: 'Tap to answer',
          sound: 'default',
          badge: 1,
          data: {
            type: 'incoming_call',
            callId: call.id,
            callerId: user.id,
            callerName: caller?.username || 'Someone',
            callerAvatar: caller?.avatar_url || '',
            roomName: roomName,
          },
        }),
      })
    }

    return new Response(
      JSON.stringify({
        call: call,
        caller: caller,
        callee: callee,
      }),
      { 
        status: 200, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  } catch (error) {
    return new Response(
      JSON.stringify({ error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
