import { createClient } from '@supabase/supabase-js';
import { logger } from '../utils/logger';

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

// Check if Supabase is properly configured
const isSupabaseConfigured =
  supabaseUrl &&
  supabaseAnonKey &&
  supabaseUrl !== 'your-supabase-project-url' &&
  supabaseAnonKey !== 'your-supabase-anon-key';

if (!isSupabaseConfigured) {
  logger.warn('Supabase is not properly configured. Authentication features will be disabled.');
  logger.warn('Please set SUPABASE_URL and SUPABASE_ANON_KEY in your .env file');
}

// Client for public operations (user-facing)
export const supabase =
  isSupabaseConfigured && supabaseUrl && supabaseAnonKey
    ? createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          autoRefreshToken: true,
          persistSession: false, // We'll handle sessions on the frontend
        },
      })
    : null;

// Admin client for server-side operations (requires service role key)
export const supabaseAdmin =
  isSupabaseConfigured &&
  supabaseUrl &&
  supabaseServiceKey &&
  supabaseServiceKey !== 'your-supabase-service-role-key'
    ? createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
      })
    : null;

if (!supabaseAdmin && isSupabaseConfigured) {
  logger.warn('Supabase admin client not initialized. Some admin operations may not be available.');
}

export const isSupabaseEnabled = isSupabaseConfigured;

export default supabase;
