"use client";

export interface User {
  sub: string;
  orgId: string;
  role: "guest" | "staff" | "manager" | "admin";
  departmentId?: string;
  exp?: number;
  iat?: number;
}

const TOKEN_KEY = "hospiq_token";

export function getToken(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem(TOKEN_KEY);
}

export function setToken(token: string) {
  localStorage.setItem(TOKEN_KEY, token);
}

export function clearToken() {
  localStorage.removeItem(TOKEN_KEY);
}

export function getUser(): User | null {
  const token = getToken();
  if (!token) return null;

  try {
    const payload = token.split(".")[1];
    if (!payload) return null;
    const decoded = JSON.parse(atob(payload));

    // Check expiration
    if (decoded.exp && decoded.exp * 1000 < Date.now()) {
      clearToken();
      return null;
    }

    return decoded as User;
  } catch {
    clearToken();
    return null;
  }
}

export function isAuthenticated(): boolean {
  return getUser() !== null;
}
