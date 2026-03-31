import { createClient } from '@supabase/supabase-js';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

// Lazy-initialized clients — avoids crashing at build time when env vars are not set
let _supabase = null;
let _supabaseAdmin = null;

/**
 * Client-side Supabase client (uses anon key, respects RLS).
 */
export const supabase = new Proxy({}, {
  get(_, prop) {
    if (!_supabase) {
      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY');
      }
      _supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' });
          },
        },
      });
    }
    return _supabase[prop];
  },
});

/**
 * Server-side Supabase client (uses service role key, bypasses RLS).
 */
export const supabaseAdmin = new Proxy({}, {
  get(_, prop) {
    if (!_supabaseAdmin) {
      if (!supabaseUrl || !supabaseServiceKey) {
        throw new Error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
      }
      _supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
        auth: {
          autoRefreshToken: false,
          persistSession: false,
        },
        global: {
          fetch: (url, options) => {
            return fetch(url, { ...options, cache: 'no-store' });
          },
        },
      });
    }
    return _supabaseAdmin[prop];
  },
});
