import { createClient } from '@supabase/supabase-js';

// ⚠️ ضع هنا بيانات مشروعك على Supabase
const SUPABASE_URL =
  import.meta.env.VITE_SUPABASE_URL || 'https://rcjalddjkzgznvvilmwm.supabase.co';
const SUPABASE_ANON_KEY =
  import.meta.env.VITE_SUPABASE_ANON_KEY || 'sb_publishable_mKtDaa_WCcCM6z4uKWAlOw_Q5Ebds7q';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
