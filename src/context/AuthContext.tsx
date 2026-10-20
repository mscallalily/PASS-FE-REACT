import React, { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { ApiError, jsonRequest } from '../lib/http';
export type UserRole = 'admin' | 'parking_staff' | 'student' | 'faculty' | 'employee' | 'guest' | null;
interface AuthUser { id: string; name: string; email: string; role: UserRole; idNum?: string; dept?: string; accountStatus?: string; emailVerified?: boolean; schoolIdSubmitted?: boolean; }
interface AuthContextType { user: AuthUser | null; login: (identifier: string, password: string, remember?: boolean) => Promise<{ success: boolean; role: UserRole }>; logout: () => Promise<void>; isAuthenticated: boolean; ready: boolean; }
interface ApiUser extends Omit<AuthUser, 'role'> { role: string | null; }
interface ApiResponse { token?: string; user?: ApiUser; }
const AuthContext = createContext<AuthContextType | null>(null), TOKEN_KEY = 'pass_auth_token';
export const REGULAR_USER_ROLES: UserRole[] = ['student', 'faculty', 'employee'];
export function roleLabel(role: UserRole) { return role === 'parking_staff' ? 'Parking Staff' : role === 'admin' ? 'Administrator' : role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User'; }
function role(value: string | null): UserRole {
  const r = value?.toLowerCase();
  if (['admin', 'administrator', 'parking_admin'].includes(r || '')) return 'admin';
  if (['security', 'parking', 'parking_staff'].includes(r || '')) return 'parking_staff';
  return ['student', 'faculty', 'employee', 'guest'].includes(r || '') ? r as UserRole : null;
}
function toUser(u: ApiUser): AuthUser { return { ...u, id: String(u.id), role: role(u.role) }; }
function token() { return localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY); }
function clear() { localStorage.removeItem(TOKEN_KEY); sessionStorage.removeItem(TOKEN_KEY); }
export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null), [restoring, setRestoring] = useState(true), [error, setError] = useState(''), [revision, setRevision] = useState(0);
  useEffect(() => {
    const storage = (event: StorageEvent) => { if (event.key === TOKEN_KEY || event.key === null) { setUser(null); setRestoring(true); setRevision(v => v + 1); } };
    const expired = (event: Event) => {
      const expected = (event as CustomEvent<{ token?: string }>).detail?.token;
      if (expected && expected !== token()) return;
      clear(); setUser(null); setError('');
    };
    const restoredPage = (event: PageTransitionEvent) => { if (event.persisted) { setUser(null); setRestoring(true); setRevision(v => v + 1); } };
    window.addEventListener('pageshow', restoredPage);
    window.addEventListener('storage', storage); window.addEventListener('pass-session-expired', expired);
    return () => { window.removeEventListener('pageshow', restoredPage); window.removeEventListener('storage', storage); window.removeEventListener('pass-session-expired', expired); };
  }, []);
  useEffect(() => {
    const controller = new AbortController(), saved = token(); setError('');
    if (!saved) { setUser(null); setRestoring(false); return; }
    setRestoring(true);
    jsonRequest<ApiResponse>('/api/me', { headers: { Accept: 'application/json', Authorization: 'Bearer ' + saved }, signal: controller.signal })
      .then(data => { if (controller.signal.aborted || token() !== saved) return; if (!data.user || !role(data.user.role)) throw new Error('The server returned an incomplete session.'); setUser(toUser(data.user)); })
      .catch(e => { if (controller.signal.aborted || token() !== saved) return; if (e instanceof ApiError && e.status === 401) { clear(); setUser(null); } else setError(e.message || 'Unable to check your session.'); })
      .finally(() => { if (!controller.signal.aborted) setRestoring(false); });
    return () => controller.abort();
  }, [revision]);
  const login: AuthContextType['login'] = async (identifier, password, remember = false) => {
    const data = await jsonRequest<ApiResponse>('/api/login', { method: 'POST', headers: { Accept: 'application/json', 'Content-Type': 'application/json' }, body: JSON.stringify({ identifier: identifier.trim(), password }) });
    if (!data.token || !data.user || !role(data.user.role)) throw new Error('Your account has no recognized PASS role. Contact PASS staff.');
    clear(); (remember ? localStorage : sessionStorage).setItem(TOKEN_KEY, data.token); const next = toUser(data.user); setUser(next); setError(''); setRestoring(false); return { success: true, role: next.role };
  };
  const logout = async () => {
    const saved = token(); clear(); setUser(null); setError('');
    if (saved) { try { await jsonRequest('/api/logout', { method: 'POST', headers: { Accept: 'application/json', Authorization: 'Bearer ' + saved } }); } catch { /* Local sign-out succeeds; an offline server revocation cannot be confirmed. */ } }
  };
  return <AuthContext.Provider value={{ user, login, logout, isAuthenticated: !!user, ready: !restoring }}>
    {restoring ? <div role="status" className="min-h-screen flex items-center justify-center text-slate-600 p-6">Restoring your session…</div> : error && !user ? <main className="min-h-screen p-6 flex items-center justify-center"><section className="max-w-sm space-y-4"><h1 className="text-xl font-bold">Unable to check your session</h1><p role="alert" className="text-sm text-slate-600 break-words">{error}</p><button className="rounded-xl bg-blue-600 px-5 py-3 text-white" onClick={() => setRevision(v => v + 1)}>Retry</button><button className="block text-sm text-blue-700" onClick={() => { void logout(); }}>Sign out on this device</button></section></main> : children}
  </AuthContext.Provider>;
}
export function useAuth() { const context = useContext(AuthContext); if (!context) throw new Error('useAuth must be used within AuthProvider'); return context; }
