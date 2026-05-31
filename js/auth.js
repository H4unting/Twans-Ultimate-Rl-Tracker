/** Supabase Auth — Google OAuth + session management */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SUPABASE_SOURCES = [
  './vendor/supabase-js.mjs',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm',
  'https://esm.sh/@supabase/supabase-js@2.49.1',
];

let supabase = null;
let currentSession = null;
const authListeners = new Set();

async function loadSupabaseModule() {
  let lastError = null;
  for (const src of SUPABASE_SOURCES) {
    try {
      return await import(src);
    } catch (e) {
      lastError = e;
    }
  }
  throw new Error(
    lastError?.message?.includes('Failed to fetch')
      ? 'Could not load sign-in library — check internet or disable Brave Shields for localhost:8080'
      : `Could not load sign-in library — ${lastError?.message || 'unknown error'}`,
  );
}

async function getSupabaseClient() {
  if (supabase) return supabase;
  const { createClient } = await loadSupabaseModule();
  supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });
  return supabase;
}

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
  const client = await getSupabaseClient();
  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;
  notifyAuth(session);

  client.auth.onAuthStateChange((_event, session) => {
    notifyAuth(session);
  });

  return session;
}

export async function signInWithGoogle() {
  const client = await getSupabaseClient();
  const redirectTo = getRedirectUrl();
  const { data, error } = await client.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo },
  });
  if (error) throw error;
  if (data?.url) {
    window.location.assign(data.url);
    return;
  }
  throw new Error('Google sign-in did not return a redirect URL. Check Supabase Google provider settings.');
}

export async function signInWithEmail(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const client = await getSupabaseClient();
  const { data, error } = await client.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: getRedirectUrl() },
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const client = await getSupabaseClient();
  const { error } = await client.auth.resetPasswordForEmail(email.trim(), {
    emailRedirectTo: getRedirectUrl(),
  });
  if (error) throw error;
}

export async function signOut() {
  const client = await getSupabaseClient();
  const { error } = await client.auth.signOut();
  if (error) throw error;
  notifyAuth(null);
}
