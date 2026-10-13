
import React, {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react';

export type UserRole =
  | 'admin'
  | 'parking_staff'
  | 'student'
  | 'faculty'
  | 'employee'
  | 'guest'
  | null;

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  idNum?: string;
  dept?: string;
}

interface AuthContextType {
  user: AuthUser | null;
  login: (
    identifier: string,
    password: string,
    remember?: boolean
  ) => Promise<{ success: boolean; role: UserRole }>;
  logout: () => Promise<void>;
  isAuthenticated: boolean;
}

interface ApiUser {
  id: string;
  name: string;
  email: string;
  role: string | null;
  idNum?: string;
  dept?: string;
}

interface ApiResponse {
  message?: string;
  token?: string;
  user?: ApiUser;
}

const AuthContext = createContext<AuthContextType | null>(null);

const TOKEN_KEY = 'pass_auth_token';

export const REGULAR_USER_ROLES: UserRole[] = [
  'student',
  'faculty',
  'employee',
];

export function roleLabel(role: UserRole) {
  if (role === 'parking_staff') return 'Parking Staff';
  if (role === 'admin') return 'Administrator';
  return role ? role.charAt(0).toUpperCase() + role.slice(1) : 'User';
}

function normalizeRole(role: string | null): UserRole {
  switch (role?.toLowerCase()) {
    case 'admin':
    case 'administrator':
      return 'admin';

    case 'security':
    case 'parking':
    case 'parking_staff':
      return 'parking_staff';

    case 'student':
    case 'faculty':
    case 'employee':
    case 'guest':
      return role.toLowerCase() as UserRole;

    default:
      return null;
  }
}

function toAuthUser(apiUser: ApiUser): AuthUser {
  return {
    id: String(apiUser.id),
    name: apiUser.name,
    email: apiUser.email,
    role: normalizeRole(apiUser.role),
    idNum: apiUser.idNum,
    dept: apiUser.dept,
  };
}

function getStoredToken(): string | null {
  return (
    localStorage.getItem(TOKEN_KEY) ||
    sessionStorage.getItem(TOKEN_KEY)
  );
}

function storeToken(token: string, remember: boolean) {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);

  const storage = remember ? localStorage : sessionStorage;
  storage.setItem(TOKEN_KEY, token);
}

function clearStoredToken() {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
}

async function readResponse(response: Response): Promise<ApiResponse> {
  const data = (await response.json().catch(() => ({}))) as ApiResponse;

  if (!response.ok) {
    throw new Error(
      data.message || `Request failed with status ${response.status}.`
    );
  }

  return data;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function restoreSession() {
      const token = getStoredToken();
      if (!token) return;

      try {
        const response = await fetch('/api/me', {
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });

        const data = await readResponse(response);

        if (!data.user || cancelled) return;

        const restoredUser = toAuthUser(data.user);

        if (!restoredUser.role) {
          clearStoredToken();
          return;
        }

        setUser(restoredUser);
      } catch {
        clearStoredToken();
      }
    }

    void restoreSession();

    return () => {
      cancelled = true;
    };
  }, []);

  const login: AuthContextType['login'] = async (
    identifier,
    password,
    remember = false
  ) => {
    const response = await fetch('/api/login', {
      method: 'POST',
      headers: {
        Accept: 'application/json',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        identifier: identifier.trim(),
        password,
      }),
    });

    const data = await readResponse(response);

    if (!data.token || !data.user) {
      throw new Error('The server returned an incomplete login response.');
    }

    const authenticatedUser = toAuthUser(data.user);

    if (!authenticatedUser.role) {
      throw new Error(
        'Your account has no recognized PASS role. Please contact the administrator.'
      );
    }

    storeToken(data.token, remember);
    setUser(authenticatedUser);

    return {
      success: true,
      role: authenticatedUser.role,
    };
  };

  const logout: AuthContextType['logout'] = async () => {
    const token = getStoredToken();

    try {
      if (token) {
        await fetch('/api/logout', {
          method: 'POST',
          headers: {
            Accept: 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
      }
    } finally {
      clearStoredToken();
      setUser(null);
    }
  };

  return (
    <AuthContext.Provider
      value={{
        user,
        login,
        logout,
        isAuthenticated: !!user,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);

  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }

  return ctx;
}
