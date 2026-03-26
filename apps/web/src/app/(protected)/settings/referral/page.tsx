'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function ReferralSettingsRedirect() {
  const router = useRouter();
  useEffect(() => {
    router.replace('/marketing/referrals');
  }, [router]);
  return null;
}
