/** Supabase Auth — Google OAuth + session management */

import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.49.1';
import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: {
    persistSession: true,
    autoRefreshToken: true,
    detectSessionInUrl: true,
  },
});

let currentSession = null;
const authListeners = new Set();

export function getSupabase() {
  return supabase;
}

export function getAccessToken() {
  return currentSession?.access_token ?? null;
}

export function getSession() {
  return currentSession;
}

export function getAuthUser() {
  return currentSession?.user ?? null;
}

export function onAuthChange(fn) {
  authListeners.add(fn);
  return () => authListeners.delete(fn);
}

function notifyAuth(session) {
  currentSession = session;
  authListeners.forEach(fn => fn(session));
}

export function getRedirectUrl() {
  const path = window.location.pathname.replace(/index\.html$/, '');
  const base = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${base}`;
}

export async function initAuth() {
  const { data: { session }, error } = await supabase.auth.getSession();
  if (error) throw error;
  notifyAuth(session);

  supabase.auth.onAuthStateChange((_event, session) => {
    notifyAuth(session);
  });

  return session;
}

export async function signInWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: getRedirectUrl() },
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  notifyAuth(null);
}
