// config/supabase.ts
import { createClient } from '@supabase/supabase-js';

const supabaseUrl = 'https://oblshjqrjppahkurcaft.supabase.co'; // Get from your Supabase project
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im9ibHNoanFyanBwYWhrdXJjYWZ0Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODA0MTk5MDcsImV4cCI6MjA5NTk5NTkwN30.BTv1IwklfVhihEJS0KuFHqciYCLVJPpnsVrMn_rjBVg'; // Get from Supabase settings

export const supabase = createClient(supabaseUrl, supabaseAnonKey);
