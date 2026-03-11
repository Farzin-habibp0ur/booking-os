'use client';

import { useState, useEffect, useRef } from 'react';
import { api } from '@/lib/api';
import { Search, Car, X } from 'lucide-react';

interface VehicleOption {
  id: string;
  stockNumber: string;
  year: number;
  make: string;
  model: string;
  vin?: string | null;
  status: string;
}

interface VehicleSelectorProps {
  value?: string | null;
  onChange: (vehicleId: string | null) => void;
  placeholder?: string;
}

export function VehicleSelector({ value, onChange, placeholder = 'Search vehicles...' }: VehicleSelectorProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<VehicleOption[]>([]);
  const [selected, setSelected] = useState<VehicleOption | null>(null);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  // Load selected vehicle on mount
  useEffect(() => {
    if (value && !selected) {
      api.get(`/vehicles/${value}`).then((v: any) => {
        setSelected(v);
      }).catch(() => {});
    }
  }, [value, selected]);

  // Search vehicles
  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const t = setTimeout(() => {
      api
        .get(`/vehicles?search=${encodeURIComponent(query)}&status=IN_STOCK&take=10`)
        .then((res: any) => setResults(res.data || []))
        .catch(() => setResults([]))
        .finally(() => setLoading(false));
    }, 300);
    return () => clearTimeout(t);
  }, [query, open]);

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  function handleSelect(vehicle: VehicleOption) {
    setSelected(vehicle);
    onChange(vehicle.id);
    setOpen(false);
    setQuery('');
  }

  function handleClear() {
    setSelected(null);
    onChange(null);
    setQuery('');
  }

  if (selected) {
    return (
      <div className="flex items-center justify-between bg-slate-50 dark:bg-slate-800 rounded-xl px-3 py-2.5 border border-transparent">
        <div className="flex items-center gap-2">
          <Car size={14} className="text-slate-400" />
          <span className="text-sm text-slate-900 dark:text-slate-100">
            {selected.year} {selected.make} {selected.model}
          </span>
          <span className="text-xs text-slate-400 font-mono">{selected.stockNumber}</span>
        </div>
        <button
          type="button"
          onClick={handleClear}
          className="p-1 hover:bg-slate-200 dark:hover:bg-slate-700 rounded-lg"
        >
          <X size={14} className="text-slate-400" />
        </button>
      </div>
    );
  }

  return (
    <div ref={ref} className="relative">
      <div className="relative">
        <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => setOpen(true)}
          placeholder={placeholder}
          className="w-full bg-slate-50 dark:bg-slate-800 border-transparent focus:bg-white focus:ring-2 focus:ring-sage-500 rounded-xl pl-9 pr-3 py-2.5 text-sm"
        />
      </div>

      {open && (
        <div className="absolute z-50 w-full mt-1 bg-white dark:bg-slate-900 rounded-xl shadow-soft-sm border border-slate-200 dark:border-slate-700 max-h-60 overflow-y-auto">
          {loading && (
            <div className="p-3 text-center text-xs text-slate-400">Searching...</div>
          )}
          {!loading && results.length === 0 && (
            <div className="p-3 text-center text-xs text-slate-400">No vehicles found</div>
          )}
          {results.map((v) => (
            <button
              key={v.id}
              type="button"
              onClick={() => handleSelect(v)}
              className="w-full px-3 py-2 text-left hover:bg-slate-50 dark:hover:bg-slate-800 flex items-center gap-2 text-sm"
            >
              <Car size={14} className="text-slate-400 shrink-0" />
              <span className="text-slate-900 dark:text-slate-100">
                {v.year} {v.make} {v.model}
              </span>
              <span className="text-xs text-slate-400 font-mono ml-auto">{v.stockNumber}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
