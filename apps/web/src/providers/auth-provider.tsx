'use client';
import { useQueryClient } from '@tanstack/react-query';
import { useEffect, type ReactNode } from 'react';
import { configureAuthFailureHandler } from '@/lib/api';
export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) { const client = useQueryClient(); useEffect(() => configureAuthFailureHandler(() => client.clear()), [client]); return children; }
