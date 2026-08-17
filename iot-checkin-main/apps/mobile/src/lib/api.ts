import axios from 'axios';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Platform } from 'react-native';
import Config from 'react-native-config';

const rawURL = Config.NEXT_PUBLIC_API_URL || 'http://localhost:3000/api';
let baseURL = rawURL;

if (Platform.OS === 'android') {
  baseURL = rawURL.replace('localhost', '10.0.2.2');
} else if (Platform.OS === 'web' && typeof window !== 'undefined') {
  // If accessing from phone via LAN IP (e.g. 192.168.0.x), point API to the same IP
  if (window.location.hostname !== 'localhost' && rawURL.includes('localhost')) {
    baseURL = rawURL.replace('localhost', window.location.hostname);
  }
}


export const api = axios.create({
  baseURL,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Request interceptor to add the auth token header to requests
api.interceptors.request.use(
  async (config) => {
    try {
      const token = await AsyncStorage.getItem('token');
      if (token) {
        config.headers.Authorization = `Bearer ${token}`;
      }
    } catch (error) {
      console.error('Error fetching token from AsyncStorage', error);
    }
    return config;
  },
  (error) => {
    return Promise.reject(error);
  }
);
