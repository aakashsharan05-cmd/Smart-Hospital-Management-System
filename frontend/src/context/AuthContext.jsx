import React, { createContext, useContext, useState, useEffect } from 'react';
import { loginUser, registerUser, getCurrentUser } from '../services/api';
import { getToken, setStoredToken, removeStoredAuth, USER_KEY } from '../utils/auth';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(() => {
    try {
      const saved = typeof window !== 'undefined' ? localStorage.getItem(USER_KEY) : null;
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });
  const [token, setToken] = useState(() => getToken());
  const [loading, setLoading] = useState(true);

  // Validate session on mount
  useEffect(() => {
    let isMounted = true;

    const verifySession = async () => {
      const storedToken = getToken();
      if (!storedToken) {
        if (isMounted) {
          setUser(null);
          setToken(null);
          setLoading(false);
        }
        return;
      }

      try {
        const response = await getCurrentUser();
        if (response && response.success && response.user) {
          if (isMounted) {
            setUser(response.user);
            localStorage.setItem(USER_KEY, JSON.stringify(response.user));
          }
        } else {
          // Token invalid or user not found
          if (isMounted) {
            setUser(null);
            setToken(null);
            removeStoredAuth();
          }
        }
      } catch (err) {
        console.error('Session verification failed:', err);
        if (isMounted) {
          setUser(null);
          setToken(null);
          removeStoredAuth();
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };

    verifySession();

    return () => {
      isMounted = false;
    };
  }, []);

  const login = async (email, password) => {
    const data = await loginUser({ email, password });
    if (data.token && data.user) {
      setToken(data.token);
      setUser(data.user);
      setStoredToken(data.token);
      localStorage.setItem(USER_KEY, JSON.stringify(data.user));
    }
    return data;
  };

  const register = async (userData) => {
    return await registerUser(userData);
  };

  const logout = () => {
    removeStoredAuth();
    setUser(null);
    setToken(null);
    window.location.href = '/login';
  };

  const updateUser = (updatedData) => {
    setUser((prev) => {
      const next = { ...prev, ...updatedData };
      localStorage.setItem('shms_user', JSON.stringify(next));
      return next;
    });
  };

  const value = {
    user,
    token,
    loading,
    isAuthenticated: !!token && !!user,
    login,
    register,
    logout,
    updateUser,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};

export default AuthContext;
