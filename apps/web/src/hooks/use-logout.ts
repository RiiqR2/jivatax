'use client';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { authService } from '@/services/auth.service';
export function useLogout() { const queryClient = useQueryClient(); const router = useRouter(); return useMutation({ mutationFn: authService.logout, onSettled: async () => { queryClient.clear(); router.replace('/login'); } }); }
