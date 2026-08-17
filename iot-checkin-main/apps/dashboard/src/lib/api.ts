import axios from 'axios';

// Ensure baseURL doesn't double up strictly by using exactly what NextJS passes in, minus any trailing slashes
const rawBase = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
const baseURL = rawBase.endsWith('/') ? rawBase.slice(0, -1) : rawBase;

export const api = axios.create({
  baseURL,
});

api.interceptors.request.use(
  (config) => {
    if (typeof window !== 'undefined') {
      const token = localStorage.getItem('auth_token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
