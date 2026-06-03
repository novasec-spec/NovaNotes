// utils/testSupabase.ts
import { supabase } from '../config/supabase';

export async function testConnection() {
  console.log('Testing Supabase connection...');
  
  // Simple test query
  const { data, error } = await supabase
    .from('user_data')
    .select('count', { count: 'exact', head: true });
  
  if (error) {
    console.error('Connection FAILED:', error.message);
    return false;
  }
  
  console.log('Connection SUCCESS! Table exists.');
  return true;
}
