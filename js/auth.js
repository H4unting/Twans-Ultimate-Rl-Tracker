/** Supabase Auth — Google OAuth + session management */

import { SUPABASE_URL, SUPABASE_KEY } from './config.js';

const SUPABASE_SOURCES = [
  './vendor/supabase-js.mjs',
  'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.49.1/+esm',
  'https://esm.sh/@supabase/supabase-js@2.49.1',
];

let supabase = null;
let currentSession = null;
let authListenerWired = false;
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
      flowType: 'implicit',
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

export function hasPendingAuthHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return false;
  const params = new URLSearchParams(hash);
  return Boolean(params.get('access_token') || params.get('error') || params.get('error_description'));
}

function stripAuthHashFromUrl() {
  if (!hasPendingAuthHash()) return;
  const url = new URL(window.location.href);
  url.hash = '';
  window.history.replaceState(null, '', `${url.pathname}${url.search}`);
}

function parseAuthHash() {
  const hash = window.location.hash.replace(/^#/, '');
  if (!hash) return null;
  const params = new URLSearchParams(hash);
  const error = params.get('error');
  if (error) {
    throw new Error(params.get('error_description') || error);
  }
  const access_token = params.get('access_token');
  if (!access_token) return null;
  return {
    access_token,
    refresh_token: params.get('refresh_token') || '',
  };
}

async function recoverSessionFromUrlHash(client) {
  const tokens = parseAuthHash();
  if (!tokens) return null;
  const { data, error } = await client.auth.setSession({
    access_token: tokens.access_token,
    refresh_token: tokens.refresh_token,
  });
  if (error) throw error;
  return data.session ?? null;
}

export function getRedirectUrl() {
  const path = window.location.pathname.replace(/index\.html$/, '');
  const base = path.endsWith('/') ? path : `${path}/`;
  return `${window.location.origin}${base}`;
}

function wireSupabaseAuthListener(client) {
  if (authListenerWired) return;
  authListenerWired = true;
  client.auth.onAuthStateChange((_event, session) => {
    notifyAuth(session);
    if (session) stripAuthHashFromUrl();
  });
}

export async function initAuth() {
  const client = await getSupabaseClient();
  wireSupabaseAuthListener(client);

  const pendingHash = hasPendingAuthHash();

  const { data: { session }, error } = await client.auth.getSession();
  if (error) throw error;

  if (session) {
    notifyAuth(session);
    stripAuthHashFromUrl();
    return session;
  }

  if (pendingHash) {
    try {
      const manual = await recoverSessionFromUrlHash(client);
      if (manual) {
        notifyAuth(manual);
        stripAuthHashFromUrl();
        return manual;
      }
    } catch (e) {
      console.warn('OAuth hash recovery failed:', e);
      throw e;
    }
    const recovered = await waitForSession(client, 8000);
    notifyAuth(recovered);
    if (recovered) stripAuthHashFromUrl();
    return recovered;
  }

  notifyAuth(null);
  return null;
}

function waitForSession(client, timeoutMs) {
  return new Promise((resolve) => {
    let settled = false;
    let authSub = null;
    const finish = (session) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      authSub?.data?.subscription?.unsubscribe();
      resolve(session);
    };

    authSub = client.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });

    client.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session);
    });

    const timer = setTimeout(async () => {
      const { data: { session } } = await client.auth.getSession();
      finish(session ?? null);
    }, timeoutMs);
  });
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
