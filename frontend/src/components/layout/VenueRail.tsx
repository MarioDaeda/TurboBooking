'use client';

import React from 'react';
import { Venue } from '@/types';

interface VenueRailProps {
  venues: Venue[];
  activeVenueId: string;
  onSelectVenue: (venueId: string) => void;
}

export const VenueRail: React.FC<VenueRailProps> = ({
  venues,
  activeVenueId,
  onSelectVenue,
}) => {
  return (
    <aside className="w-16 bg-tw-rail flex flex-col items-center py-4 gap-3 select-none flex-shrink-0 z-30 shadow-md">
      {venues.map((venue) => {
        const isActive = venue.id === activeVenueId;
        return (
          <div key={venue.id} className="flex flex-col items-center gap-1 group">
            <button
              onClick={() => onSelectVenue(venue.id)}
              title={venue.name}
              className={`relative w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base transition-all duration-200 ${
                isActive
                  ? 'bg-white text-tw-rail-dark shadow-md ring-2 ring-white/50 scale-105'
                  : 'bg-white/20 text-white hover:bg-white/30 hover:scale-102'
              }`}
            >
              <span>{venue.shortname}</span>
              {/* Online Green Indicator Dot */}
              <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-tw-rail rounded-full shadow-sm" />
            </button>
            <span className="text-[10px] text-white/80 font-medium tracking-tight">
              {venue.shortname}
            </span>
          </div>
        );
      })}
    </aside>
  );
};
