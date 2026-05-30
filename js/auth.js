/** Supabase Auth — Google OAuth + session management */

import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm';
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
  const redirectTo = getRedirectUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
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
  const { data, error } = await supabase.auth.signInWithPassword({
    email: email.trim(),
    password,
  });
  if (error) throw error;
  return data;
}

export async function signUpWithEmail(email, password) {
  const { data, error } = await supabase.auth.signUp({
    email: email.trim(),
    password,
    options: { emailRedirectTo: getRedirectUrl() },
  });
  if (error) throw error;
  return data;
}

export async function sendPasswordReset(email) {
  const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
    emailRedirectTo: getRedirectUrl(),
  });
  if (error) throw error;
}

export async function signOut() {
  const { error } = await supabase.auth.signOut();
  if (error) throw error;
  notifyAuth(null);
}
