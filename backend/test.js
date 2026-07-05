// test-token.ts (run with Deno or Node)
import  jwt from 'jsonwebtoken';

const API_KEY = 'APIfeK4aTdAcL3PrvHZOQfZ';
const API_SECRET = 'secret7xtxHDr6Xl7pqmcxQMZ7M90AebHEuO96JLw8xd3p';
const ROOM_NAME = 'test-room';

function generateToken() {
  const payload = {
    iss: API_KEY,
    sub: 'test_user',
    name: 'Test User',
    video: {
      room: ROOM_NAME,
      roomJoin: true,
      canPublish: true,
      canSubscribe: true,
    },
    exp: Math.floor(Date.now() / 1000) + (60 * 60), // 1 hour
  };

  return jwt.sign(payload, API_SECRET, { algorithm: 'HS256' });
}

console.log('🔑 Test Token:', generateToken());
