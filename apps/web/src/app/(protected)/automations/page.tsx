'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AutomationsRedirectPage() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/ai/automations');
  }, [router]);
  return (
    <div className="flex items-center justify-center min-h-[50vh]">
      <p className="text-slate-500 text-sm">Redirecting to AI Hub...</p>
    </div>
  );
}
