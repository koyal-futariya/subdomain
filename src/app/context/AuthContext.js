"use client";
import { createContext, useContext, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export const AuthContext = createContext({});

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  // API Configuration - Connect to your Express backend
  const API_BASE_URL = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:5002';

  // Single, resilient logout routine used by logout() and by other pages if needed
  const handleLogout = async (hardRedirect = true) => {
    try {
      const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;

      // Optional: backend logout; ignore failures
      if (token) {
        await fetch(`${API_BASE_URL}/api/auth/logout`, {
          method: 'POST',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        }).catch(() => {});
      }
    } catch {
      // ignore logout request errors
    } finally {
      // Clear both admin and blogs namespaces plus generic keys
      try {
        const keys = [
          // blogs namespace
          'blogToken', 'blogsToken', 'blogsRole', 'blogsUser',
          // admin/generic
          'adminToken', 'adminRole', 'adminUsername', 'adminEmail', 'adminId', 'userData', 'isAdminLoggedIn'
        ];
        keys.forEach(k => localStorage.removeItem(k));
      } catch {
        // ignore storage errors (e.g., privacy mode)
      }

      setUser(null);

      if (hardRedirect) {
        // Hard redirect with history replacement so Back can't return here
        window.location.replace('/AdminLogin?logout=1'); // replaces current entry in history [2][1][11]
      } else {
        // SPA navigation fallback (doesn't force full reload)
        router.replace('/AdminLogin?logout=1');
      }
    }
  };

  useEffect(() => {
    const checkAuth = async () => {
      try {
        const token = typeof window !== 'undefined' ? localStorage.getItem('adminToken') : null;
        if (!token) {
          setLoading(false);
          return;
        }

        // Validate token with backend
        const res = await fetch(`${API_BASE_URL}/api/auth/validate-token`, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${token}`,
            'Content-Type': 'application/json'
          },
          credentials: 'include'
        });

        if (res.ok) {
          const userData = await res.json();

          // Normalize role to lowercase
          const normalizedRole = userData.role ? String(userData.role).toLowerCase() : '';

          setUser({
            id: userData.id,
            username: userData.username,
            email: userData.email,
            role: normalizedRole,
            isActive: userData.isActive,
            lastLogin: userData.lastLogin
          });

          // Sync localStorage with validated data
          try {
            localStorage.setItem('adminRole', normalizedRole);
            localStorage.setItem('adminUsername', userData.username || '');
            localStorage.setItem('adminEmail', userData.email || '');
            localStorage.setItem('adminId', userData.id || '');
            localStorage.setItem('isAdminLoggedIn', 'true');
          } catch {
            // ignore storage errors
          }
        } else {
          // Invalid token -> full logout clear (use SPA replace to avoid extra reload when auto-check fails)
          await handleLogout(false);
        }
      } catch {
        await handleLogout(false);
      } finally {
        setLoading(false);
      }
    };

    checkAuth();
  }, [API_BASE_URL]); // re-run if backend URL changes

  const login = (userData) => {
    // Normalize role to lowercase
    const normalizedRole = userData.role ? String(userData.role).toLowerCase() : '';

    // Store all user data with normalized role
    const userInfo = {
      id: userData.id,
      username: userData.username,
      email: userData.email,
      role: normalizedRole,
      isActive: userData.isActive,
      lastLogin: userData.lastLogin || new Date().toISOString()
    };

    // Update state
    setUser(userInfo);

    // Persist
    try {
      localStorage.setItem('adminToken', userData.token || '');
      localStorage.setItem('adminRole', normalizedRole);
      localStorage.setItem('adminUsername', userInfo.username || '');
      localStorage.setItem('adminEmail', userInfo.email || '');
      localStorage.setItem('adminId', userInfo.id || '');
      localStorage.setItem('userData', JSON.stringify(userInfo));
      localStorage.setItem('isAdminLoggedIn', 'true');
    } catch {
      // ignore storage errors
    }
  };

  const logout = async () => {
    // Use the centralized routine; prefer hard redirect for full reset and to avoid history loops
    await handleLogout(true);
  };

  const isAuthenticated = () => {
    // Both in-memory user and token presence
    try {
      return !!user && !!localStorage.getItem('adminToken');
    } catch {
      return !!user;
    }
  };

  const hasRole = (requiredRoles) => {
    if (!user) return false;
    if (typeof requiredRoles === 'string') {
      return user.role === requiredRoles.toLowerCase();
    }
    if (Array.isArray(requiredRoles)) {
      return requiredRoles.some((role) => user.role === String(role).toLowerCase());
    }
    return false;
    };

  const value = {
    user,
    loading,
    login,
    logout,
    isAuthenticated,
    hasRole,
    // expose handleLogout if other pages want to bind back button -> logout
    handleLogout
  };

  return (
    <AuthContext.Provider value={value}>
      {!loading && children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
