'use client';

import { useEffect, useState } from 'react';
import { api } from './api';

export function usePlan() {
  const [plan, setPlan] = useState<string>('free');

  useEffect(() => {
    api
      .get<{ plan: string }>('/billing/status')
      .then((res) => setPlan(res.plan || 'free'))
      .catch(() => {});
  }, []);

  return plan;
}
