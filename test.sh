SUPABASE_URL="https://oblshjqrjppahkurcaft.supabase.co"
SUPABASE_KEY="eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHNoanFyanBwYWhrdXJjYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTk5MDcsImV4cCI6MjA5NTk5NTkwN30.BTv1IwklfVhihEJS0KuFHqciYCLVJPpnsVrMn_rjBVg"
LIVEKIT_URL="wss://livekit-server-production-63f0.up.railway.app"

echo "🧪 Testing Call Flow"

# Test 1: LiveKit server
echo "📡 Testing LiveKit..."
curl -s $LIVEKIT_URL && echo " ✅ LiveKit OK" || echo " ❌ LiveKit failed"

# Test 2: Initiate call (replace with real IDs)
echo "📞 Testing calls-initiate..."
curl -s -X POST "$SUPABASE_URL/functions/v1/calls-initiate" \
  -H "Authorization: Bearer $SUPABASE_KEY" \
  -H "Content-Type: application/json" \
  -d '{"calleeId": "test-user-id"}' && echo " ✅ Initiate OK" || echo " ❌ Initiate failed"

echo "✅ All tests complete!"
