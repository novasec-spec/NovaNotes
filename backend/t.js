// test-edge.js
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJBUElmZUs0YVRkQWNMM1BydkhaT1FmWiIsInN1YiI6InRlc3RfdXNlciIsIm5hbWUiOiJUZXN0IFVzZXIiLCJ2aWRlbyI6eyJyb29tIjoidGVzdC1yb29tIiwicm9vbUpvaW4iOnRydWUsImNhblB1Ymxpc2giOnRydWUsImNhblN1YnNjcmliZSI6dHJ1ZX0sImV4cCI6MTc4MzI2NDIwNywiaWF0IjoxNzgzMjYwNjA3fQ.nZspRTm_vZz44HAjG-5nKinC2EVlEUKWFzAkm0MI3LI'
const SUPABASE_URL = 'https://oblshjqrjppahkurcaft.supabase.co';

async function testInitiateCall() {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/calls-initiate`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      calleeId: 'f80a7003-0c0c-4c8e-b04c-a4972db82bb6', 
    }),
  });
  
  const data = await response.json();
  console.log('📞 Initiate Call Response:', data);
  return data;
}

async function testAcceptCall(callId) {
  const response = await fetch(`${SUPABASE_URL}/functions/v1/calls-accept`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ callId }),
  });
  
  const data = await response.json();
  console.log('✅ Accept Call Response:', data);
  return data;
}

// Run tests
const call = await testInitiateCall();
if (call?.call?.id) {
  await testAcceptCall(call.call.id);
}
