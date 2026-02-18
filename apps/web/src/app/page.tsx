'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { getModeByKey, AppMode } from '@/lib/mode-config';

export default function Home() {
  const router = useRouter();
  useEffect(() => {
    const token = localStorage.getItem('token');
    if (!token) {
      router.replace('/login');
      return;
    }
    // Use stored mode to determine landing page
    const storedMode = localStorage.getItem('app-mode') as AppMode | null;
    const modeDef = storedMode ? getModeByKey(storedMode) : null;
    const landing = modeDef?.defaultLandingPath || '/dashboard';
    router.replace(landing);
  }, [router]);
  return null;
}
