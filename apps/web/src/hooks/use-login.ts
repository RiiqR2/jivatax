'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { authService } from '@/services/auth.service';
import { sessionQueryKey } from './use-session';
export function useLogin() { const queryClient = useQueryClient(); return useMutation({ mutationFn: authService.login, onSuccess: (session) => queryClient.setQueryData(sessionQueryKey, session) }); }
