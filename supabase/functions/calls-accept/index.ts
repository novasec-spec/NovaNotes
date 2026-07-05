// supabase/functions/calls-accept/index.ts
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

    if (call.callee_id !== user.id) {
      return new Response(
        JSON.stringify({ error: 'Not authorized to accept this call' }),
        { status: 403, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Update call status
    const { data: updatedCall, error: updateError } = await supabaseClient
      .from('calls')
      .update({
        status: 'connected',
        updated_at: new Date().toISOString(),
      })
      .eq('id', callId)
      .select()
      .single()

    if (updateError) throw updateError

    // Generate LiveKit token (replace with your actual LiveKit credentials)
    const LIVEKIT_API_KEY = Deno.env.get('LIVEKIT_API_KEY') || 'your_api_key'
    const LIVEKIT_API_SECRET = Deno.env.get('LIVEKIT_API_SECRET') || 'your_api_secret'
    const LIVEKIT_SERVER_URL = Deno.env.get('LIVEKIT_SERVER_URL') || 'wss://your-livekit-server.com'

    // Generate JWT token for LiveKit
    const token = await generateLiveKitToken({
      apiKey: LIVEKIT_API_KEY,
      apiSecret: LIVEKIT_API_SECRET,
      roomName: call.room_name,
      identity: user.id,
      name: user.user_metadata?.username || 'User',
    })

    // Notify caller via push
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
          title: `📞 Call accepted`,
          body: `${call.callee?.username || 'Someone'} has answered your call`,
          sound: 'default',
          data: {
            type: 'call_accepted',
            callId: call.id,
            roomName: call.room_name,
          },
        }),
      })
    }

    return new Response(
      JSON.stringify({
        call: updatedCall,
        token: token,
        serverUrl: LIVEKIT_SERVER_URL,
        roomName: call.room_name,
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

// Helper to generate LiveKit JWT token
async function generateLiveKitToken({ apiKey, apiSecret, roomName, identity, name }: any): Promise<string> {
  // You'll need to implement JWT generation here
  // Use `jose` or `jsonwebtoken` package
  // This is a placeholder - replace with actual implementation
  return 'your_generated_token'
}
