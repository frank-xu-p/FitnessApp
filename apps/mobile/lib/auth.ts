import * as SecureStore from "expo-secure-store";
import { useAuthStore } from "../store/useAuthStore";

const SESSION_COOKIE_KEY = "fitness-session-cookie";

export async function storeSessionCookie(setCookieHeader: string | null) {
  if (!setCookieHeader) return;
  const cookie = setCookieHeader.split(",")[0].split(";")[0];
  await SecureStore.setItemAsync(SESSION_COOKIE_KEY, cookie);
  useAuthStore.getState().setSessionCookie(cookie);
}

export async function loadSessionCookie() {
  const cookie = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
  if (cookie) {
    useAuthStore.getState().setSessionCookie(cookie);
  }
  return cookie;
}

export async function clearSessionCookie() {
  await SecureStore.deleteItemAsync(SESSION_COOKIE_KEY);
  useAuthStore.getState().setSessionCookie(null);
}

export async function signIn(apiUrl: string, email: string, password: string) {
  const response = await fetch(`${apiUrl}/api/auth/sign-in/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Sign in failed");
  }

  await storeSessionCookie(response.headers.get("Set-Cookie"));
  const data = await response.json();
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function signUp(apiUrl: string, email: string, password: string, name: string) {
  const response = await fetch(`${apiUrl}/api/auth/sign-up/email`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email, password, name }),
  });

  if (!response.ok) {
    const text = await response.text();
    throw new Error(text || "Sign up failed");
  }

  await storeSessionCookie(response.headers.get("Set-Cookie"));
  const data = await response.json();
  useAuthStore.getState().setUser(data.user);
  return data;
}

export async function signOut(apiUrl: string) {
  const cookie = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
  await fetch(`${apiUrl}/api/auth/sign-out`, {
    method: "POST",
    headers: cookie ? { Cookie: cookie } : {},
  });
  await clearSessionCookie();
  useAuthStore.getState().signOut();
}

export async function getSession(apiUrl: string) {
  const cookie = await SecureStore.getItemAsync(SESSION_COOKIE_KEY);
  if (!cookie) return null;
  const response = await fetch(`${apiUrl}/api/auth/get-session`, {
    headers: { Cookie: cookie },
  });
  if (!response.ok) return null;
  const data = await response.json();
  useAuthStore.getState().setUser(data.user);
  return data;
}
