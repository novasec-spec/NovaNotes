import { requireAuth } from './authGuard';

const handleSend = async () => {
  const ok = await requireAuth('/chat');
  if (!ok) return; // guest got redirected to /welcome
  // ...proceed with sending
};
