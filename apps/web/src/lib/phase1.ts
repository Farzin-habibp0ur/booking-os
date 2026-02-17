'use client';

import {
  isPhase1Enabled,
  getPhase1Config,
  type Phase1Flag,
  type Phase1Config,
} from '@booking-os/shared';
import { useAuth } from './auth';

export function usePhase1(flag: Phase1Flag): boolean {
  const { user } = useAuth();
  return isPhase1Enabled(user?.business?.packConfig, flag);
}

export function usePhase1Config(): Phase1Config {
  const { user } = useAuth();
  return getPhase1Config(user?.business?.packConfig);
}
