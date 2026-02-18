'use client';

import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { api } from './api';

export interface PackField {
  key: string;
  type: string;
  label: string;
  options?: string[];
  required?: boolean;
  placeholder?: string;
}

interface VerticalPack {
  name: string;
  slug: string;
  labels: {
    customer: string;
    booking: string;
    service: string;
  };
  customerFields: PackField[];
  bookingFields: PackField[];
  serviceFields: PackField[];
}

const DEFAULT_PACK: VerticalPack = {
  name: 'general',
  slug: 'general',
  labels: { customer: 'Customer', booking: 'Booking', service: 'Service' },
  customerFields: [],
  bookingFields: [],
  serviceFields: [],
};

const PackContext = createContext<VerticalPack>(DEFAULT_PACK);

export function VerticalPackProvider({ children }: { children: ReactNode }) {
  const [pack, setPack] = useState<VerticalPack>(DEFAULT_PACK);

  useEffect(() => {
    // First get business to know which pack
    api
      .get<any>('/business')
      .then((biz) => {
        const packName = biz?.verticalPack || 'general';
        // Then fetch pack definition (no auth required)
        fetch(
          `${process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001/api/v1'}/vertical-packs/${packName}`,
        )
          .then((r) => r.json())
          .then((p) => {
            if (p?.name) setPack({ ...p, slug: p.slug || p.name });
          })
          .catch(() => {});
      })
      .catch(() => {});
  }, []);

  return <PackContext.Provider value={pack}>{children}</PackContext.Provider>;
}

export function usePack() {
  return useContext(PackContext);
}
