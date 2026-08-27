import React, { createContext, useContext, useState, useEffect } from 'react';
import { User } from '../types';
import { api } from '../services/api';

interface AuthContextType {
  user: User | null;
  token: string | null;
  isLoading: boolean;
  isAdmin: boolean;
  isApproved: boolean;
  login: (token: string, user: User) => void;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<User | null>(null);
  const [token, setToken] = useState<string | null>(localStorage.getItem('astra_token'));
  const [isLoading, setIsLoading] = useState<boolean>(true);

  useEffect(() => {
    const initAuth = async () => {
      const storedToken = localStorage.getItem('astra_token');
      const storedUser = localStorage.getItem('astra_user');
      if (storedUser) {
        try {
          setUser(JSON.parse(storedUser));
          setToken(storedToken || 'astra-demo-token');
        } catch {
          // ignore parsing error
        }
      } else if (storedToken) {
        try {
          const profile = await api.getMe();
          setUser(profile);
          setToken(storedToken);
        } catch (err) {
          localStorage.removeItem('astra_token');
          setUser(null);
          setToken(null);
        }
      }
      setIsLoading(false);
    };
    initAuth();
  }, []);

  const login = (newToken: string, newUser: User) => {
    localStorage.setItem('astra_token', newToken);
    localStorage.setItem('astra_user', JSON.stringify(newUser));
    setToken(newToken);
    setUser(newUser);
  };

  const logout = async () => {
    try {
      await api.logout();
    } catch (e) {
      // Ignore network errors on logout
    } finally {
      localStorage.removeItem('astra_token');
      localStorage.removeItem('astra_user');
      setToken(null);
      setUser(null);
    }
  };

  const refreshUser = async () => {
    if (token) {
      try {
        const profile = await api.getMe();
        setUser(profile);
      } catch (err) {
        console.error('Failed refreshing user:', err);
      }
    }
  };

  const isAdmin = user?.role === 'ADMIN';
  const isApproved = user?.status === 'APPROVED';

  return (
    <AuthContext.Provider
      value={{
        user,
        token,
        isLoading,
        isAdmin,
        isApproved,
        login,
        logout,
        refreshUser,
      }}
    >
      {children}
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
