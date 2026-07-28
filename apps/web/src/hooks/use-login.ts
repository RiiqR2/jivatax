'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
import { sessionKey } from './use-session';
export function useLogin() { const client = useQueryClient(); const router = useRouter(); return useMutation({ mutationFn: authService.login, onSuccess: async (session) => { client.setQueryData(sessionKey, session); await client.invalidateQueries({ queryKey: sessionKey }); router.replace('/'); } }); }
