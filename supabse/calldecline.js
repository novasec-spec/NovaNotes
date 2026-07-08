// supabase/functions/calls-decline/index.ts
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
      .select('*, caller:users!calls_caller_id_fkey(*)')
      .eq('id', callId)
      .single()

    if (callError) throw callError

    // Update call status
    await supabaseClient
      .from('calls')
      .update({
        status: 'declined',
        ended_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId)

    // Notify caller
    const { data: callerToken } = await supabaseClient
      .from('push_tokens')
      .select('expo_token')
      .eq('user_id', call.caller_id)
      .order('last_active', { ascending: false })
      .limit(1)
      .single()

    if (callerToken?.expo_token) {
      await fetch('https://exp.host/--/api/v2/push/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          to: callerToken.expo_token,
          title: '📞 Call declined',
          body: `${call.caller?.username || 'Someone'} declined your call`,
          sound: 'default',
          data: { type: 'call_declined', callId: call.id },
        }),
      })
    }

    return new Response(
      JSON.stringify({ success: true }),
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
