import axios from 'axios';
import { env } from '@/lib/env';

export const api = axios.create({
  baseURL: env.NEXT_PUBLIC_API_URL,
  headers: { Accept: 'application/json' },
  withCredentials: true,
});
