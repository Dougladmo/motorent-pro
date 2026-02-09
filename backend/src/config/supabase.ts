import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Database } from '../shared';

let supabaseInstance: SupabaseClient<Database> | null = null;

export const getSupabaseClient = (): SupabaseClient<Database> => {
  if (!supabaseInstance) {
    const url = process.env.SUPABASE_URL;
    const key = process.env.SUPABASE_SERVICE_ROLE_KEY; // Backend usa service_role

    if (!url || !key) {
      throw new Error('SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY devem estar definidos');
    }

    supabaseInstance = createClient<Database>(url, key, {
      auth: {
        autoRefreshToken: true,
        persistSession: false
      },
      global: {
        headers: {
          'x-connection-pooling': 'transaction' // Transaction mode
        }
      }
    });
  }

  return supabaseInstance;
};
