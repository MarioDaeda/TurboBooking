'use client';

import React, { useState } from 'react';
import { Armchair, Search, Plus } from 'lucide-react';

export const PostazioniView: React.FC = () => {
  const [searchQuery, setSearchQuery] = useState('');

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-full md:w-80 md:border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 flex-1 flex flex-col">
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cerca Postazione"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => alert('Aggiungi postazione')}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-tw-canvas">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
            <Armchair className="w-10 h-10" />
          </div>
          <div className="text-xs text-gray-500">
            Seleziona una postazione dall&apos;elenco o{' '}
            <button
              onClick={() => alert('Aggiungi')}
              className="text-tw-blue font-medium hover:underline"
            >
              aggiungine una nuova
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
