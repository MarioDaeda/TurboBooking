'use client';

import React from 'react';
import { Megaphone, Search } from 'lucide-react';

export const ComunicazioniView: React.FC = () => {
  return (
    <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto select-none p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Top Control Bar */}
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              PERIODO
            </span>
            <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs focus:ring-1 focus:ring-tw-blue">
              <option>DA 06/09/2025 A 06/09/2026</option>
            </select>
          </div>

          <div className="flex items-center gap-3">
            <div className="relative w-64">
              <input
                type="text"
                placeholder="Cerca"
                className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue shadow-xs"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>

            <button
              onClick={() => alert('Crea nuova comunicazione')}
              className="px-4 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold uppercase tracking-wider rounded-full shadow-xs transition"
            >
              + CREA NUOVA COMUNICAZIONE
            </button>
          </div>
        </div>

        {/* Card Content Container */}
        <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
          <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between text-xs font-semibold">
            <span className="text-gray-400 uppercase tracking-wider text-[10px]">
              COMUNICAZIONI
            </span>
            <span className="text-gray-500 font-normal">
              HAI A DISPOSIZIONE 0 EMAIL E 0 SMS.{' '}
              <button
                onClick={() => alert('Ricarica crediti')}
                className="text-tw-blue font-bold uppercase tracking-wide hover:underline ml-1"
              >
                RICARICA CREDITO
              </button>
            </span>
          </div>

          <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
              <Megaphone className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-400">Nessuna comunicazione inviata nel periodo</div>
          </div>
        </div>
      </div>
    </div>
  );
};
