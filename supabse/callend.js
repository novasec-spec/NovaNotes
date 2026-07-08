// supabase/functions/calls-end/index.ts
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

    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    if (userError || !user) {
      return new Response(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const { callId } = await req.json()

    if (!callId) {
      return new Response(
        JSON.stringify({ error: 'Call ID required' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get call details
    const { data: call, error: callError } = await supabaseClient
      .from('calls')
      .select('*, caller:users!calls_caller_id_fkey(*), callee:users!calls_callee_id_fkey(*)')
      .eq('id', callId)
      .single()

    if (callError) throw callError

    // Calculate duration
    const startedAt = new Date(call.started_at)
    const endedAt = new Date()
    const duration = Math.floor((endedAt.getTime() - startedAt.getTime()) / 1000)

    // Update call status
    await supabaseClient
      .from('calls')
      .update({
        status: 'ended',
        ended_at: endedAt.toISOString(),
        duration: duration,
        updated_at: endedAt.toISOString(),
      })
      .eq('id', callId)

    // Notify the other participant
    const otherUserId = call.caller_id === user.id ? call.callee_id : call.caller_id
    const { data: otherToken } = await supabaseClient
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', otherUserId)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()

    if (otherToken?.expo_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: otherToken.expo_token,
          title: '📞 Call ended',
          body: `Call lasted ${duration}s`,
          sound: 'default',
          data: { type: 'call_ended', callId: call.id },
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true, duration }),
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
