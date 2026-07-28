'use client';
import { useQuery } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
export const sessionQueryKey = ['auth', 'session'] as const;
export function useSession(enabled = true) { return useQuery({ queryKey: sessionQueryKey, queryFn: authService.session, enabled, retry: false }); }
