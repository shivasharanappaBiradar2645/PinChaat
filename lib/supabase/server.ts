import { createClient } from '@supabase/supabase-js';

export function getServiceRoleClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://placeholder.supabase.co';
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!serviceRoleKey || serviceRoleKey === 'placeholder-service-role-key') {
    console.warn('[Supabase Server] SUPABASE_SERVICE_ROLE_KEY is not configured.');
  }

  return createClient(supabaseUrl, serviceRoleKey || '', {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    db: {
      schema: 'pinchaat',
    },
  });
}
