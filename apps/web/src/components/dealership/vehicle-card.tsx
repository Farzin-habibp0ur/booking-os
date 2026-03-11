'use client';

import { Car, MapPin, Gauge, Calendar } from 'lucide-react';
import { vehicleStatusBadgeClasses, vehicleConditionBadgeClasses, VEHICLE_STATUS_STYLES } from '@/lib/design-tokens';

interface Vehicle {
  id: string;
  stockNumber: string;
  vin?: string | null;
  year: number;
  make: string;
  model: string;
  trim?: string | null;
  color?: string | null;
  mileage?: number | null;
  condition: string;
  status: string;
  askingPrice?: number | null;
  imageUrls: string[];
  createdAt: string;
  location?: { name: string } | null;
  _count?: { testDrives: number };
}

export function VehicleCard({
  vehicle,
  onClick,
}: {
  vehicle: Vehicle;
  onClick?: () => void;
}) {
  const daysOnLot = Math.floor(
    (Date.now() - new Date(vehicle.createdAt).getTime()) / (1000 * 60 * 60 * 24),
  );

  return (
    <div
      onClick={onClick}
      className="bg-white dark:bg-slate-900 rounded-2xl shadow-soft p-4 cursor-pointer hover:shadow-soft-lg transition-shadow border border-transparent hover:border-slate-200 dark:hover:border-slate-700 animate-card-hover"
    >
      {/* Image or placeholder */}
      <div className="w-full h-36 bg-slate-100 dark:bg-slate-800 rounded-xl mb-3 flex items-center justify-center overflow-hidden">
        {vehicle.imageUrls.length > 0 ? (
          <img
            src={vehicle.imageUrls[0]}
            alt={`${vehicle.year} ${vehicle.make} ${vehicle.model}`}
            className="w-full h-full object-cover"
          />
        ) : (
          <Car size={32} className="text-slate-300 dark:text-slate-600" />
        )}
      </div>

      {/* Title */}
      <h3 className="text-sm font-semibold text-slate-900 dark:text-slate-100 truncate">
        {vehicle.year} {vehicle.make} {vehicle.model}
        {vehicle.trim && <span className="font-normal text-slate-500"> {vehicle.trim}</span>}
      </h3>

      {/* Stock & Status */}
      <div className="flex items-center gap-2 mt-1.5">
        <span className="text-xs text-slate-400 font-mono">{vehicle.stockNumber}</span>
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${vehicleStatusBadgeClasses(vehicle.status)}`}
        >
          {VEHICLE_STATUS_STYLES[vehicle.status]?.label || vehicle.status}
        </span>
      </div>

      {/* Price */}
      {vehicle.askingPrice != null && (
        <p className="text-lg font-serif font-semibold text-slate-900 dark:text-slate-100 mt-2">
          ${Number(vehicle.askingPrice).toLocaleString()}
        </p>
      )}

      {/* Meta row */}
      <div className="flex flex-wrap items-center gap-3 mt-2 text-xs text-slate-500">
        {vehicle.mileage != null && (
          <span className="flex items-center gap-1">
            <Gauge size={12} />
            {vehicle.mileage.toLocaleString()} mi
          </span>
        )}
        {vehicle.color && (
          <span className="flex items-center gap-1">
            <span
              className="w-2.5 h-2.5 rounded-full border border-slate-200"
              style={{ backgroundColor: vehicle.color.toLowerCase() }}
            />
            {vehicle.color}
          </span>
        )}
        {vehicle.location && (
          <span className="flex items-center gap-1">
            <MapPin size={12} />
            {vehicle.location.name}
          </span>
        )}
        <span className="flex items-center gap-1">
          <Calendar size={12} />
          {daysOnLot}d on lot
        </span>
      </div>

      {/* Condition badge */}
      <div className="mt-2">
        <span
          className={`text-[10px] px-2 py-0.5 rounded-full font-medium ${vehicleConditionBadgeClasses(vehicle.condition)}`}
        >
          {vehicle.condition === 'CERTIFIED_PRE_OWNED' ? 'CPO' : vehicle.condition}
        </span>
      </div>
    </div>
  );
}
