"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import { api } from '../lib/api';
import { googleLogout } from '@react-oauth/google';
import { AuthResponse, LoginRequest, RegisterRequest } from 'libs';

export interface User {
  id: string;
  email: string;
  name?: string;
  role: 'admin' | 'user';
}

interface AuthContextType {
  user: User | null;
  isLoading: boolean;
  loginWithEmail: (dto: LoginRequest) => Promise<void>;
  registerWithEmail: (dto: RegisterRequest) => Promise<void>;
  loginWithGoogle: (idToken: string) => Promise<void>;
  logout: () => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem('auth_token');
    if (token) {
      fetchUser();
    } else {
      setIsLoading(false);
    }
  }, []);

  const fetchUser = async () => {
    try {
      const response = await api.get('/auth/me');
      setUser(response.data);
    } catch (error) {
      console.error('Failed to fetch user', error);
      localStorage.removeItem('auth_token');
      setUser(null);
    } finally {
      setIsLoading(false);
    }
  };

  const setAuthData = async (data: AuthResponse) => {
    localStorage.setItem('auth_token', data.token); 
    setUser(data.user as User);
  };

  const loginWithEmail = async (dto: LoginRequest) => {
    const response = await api.post('/auth/login', dto);
    await setAuthData(response.data);
  };

  const registerWithEmail = async (dto: RegisterRequest) => {
    const response = await api.post('/auth/register', dto);
    await setAuthData(response.data);
  };

  const loginWithGoogle = async (idToken: string) => {
    const response = await api.post('/auth/google', { idToken });
    await setAuthData(response.data);
  };

  const logout = () => {
    googleLogout();
    localStorage.removeItem('auth_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, isLoading, loginWithEmail, registerWithEmail, loginWithGoogle, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
