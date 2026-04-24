// src/integrations/supabase/server.ts
// Server-side Supabase integration for backend scripts

import { createClient } from '@supabase/supabase-js';

// These should be in your .env file
const supabaseUrl = process.env.SUPABASE_URL || 'https://your-project.supabase.co';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || 'your-service-role-key';

export const supabase = createClient(supabaseUrl, supabaseServiceKey, {
  auth: {
    autoRefreshToken: false,
    persistSession: false
  }
});

// Test function to verify connection
export const testSupabaseConnection = async () => {
  try {
    const { data, error } = await supabase
      .from('_test_connection')
      .select('*')
      .limit(1);
    
    // We expect this to fail since the table doesn't exist, but it proves the connection works
    if (error && error.code !== 'PGRST116') {
      throw error;
    }
    
    return { success: true, message: 'Supabase connection working' };
  } catch (error) {
    return { success: false, error: error.message };
  }
};
