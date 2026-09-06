'use client';

import React, { useState } from 'react';
import { Clock, Plus } from 'lucide-react';

interface OrariViewProps {
  subSection: 'orari' | 'aperture' | 'chiusure';
}

export const OrariView: React.FC<OrariViewProps> = ({ subSection }) => {
  const [salonHours, setSalonHours] = useState([
    { day: 'Domenica', hours: 'Chiuso', isOpen: false },
    { day: 'Lunedì', hours: 'Chiuso', isOpen: false },
    { day: 'Martedì', hours: '07:00 - 20:00', isOpen: true },
    { day: 'Mercoledì', hours: '07:00 - 20:00', isOpen: true },
    { day: 'Giovedì', hours: '07:00 - 20:00', isOpen: true },
    { day: 'Venerdì', hours: '07:00 - 20:00', isOpen: true },
    { day: 'Sabato', hours: '08:00 - 19:00', isOpen: true },
  ]);

  if (subSection === 'aperture') {
    return (
      <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
        <div className="w-80 border-r border-gray-200 p-4 flex flex-col bg-white">
          <button
            onClick={() => alert('Aggiungi apertura straordinaria')}
            className="w-full py-2 border border-tw-blue text-tw-blue hover:bg-blue-50 text-[11px] font-bold uppercase rounded-full transition flex items-center justify-center gap-1"
          >
            <span>AGGIUNGI APERTURA STRAORDINARIA</span>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Clock className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Scegli un elemento dall&apos;elenco o{' '}
              <button
                onClick={() => alert('Aggiungi')}
                className="text-tw-blue font-medium hover:underline"
              >
                aggiungine uno nuovo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (subSection === 'chiusure') {
    return (
      <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
        <div className="w-80 border-r border-gray-200 p-4 flex flex-col bg-white">
          <button
            onClick={() => alert('Aggiungi chiusura straordinaria')}
            className="w-full py-2 border border-tw-blue text-tw-blue hover:bg-blue-50 text-[11px] font-bold uppercase rounded-full transition flex items-center justify-center gap-1"
          >
            <span>AGGIUNGI CHIUSURA STRAORDINARIA</span>
            <Plus className="w-3.5 h-3.5" />
          </button>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Clock className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Scegli un elemento dall&apos;elenco o{' '}
              <button
                onClick={() => alert('Aggiungi')}
                className="text-tw-blue font-medium hover:underline"
              >
                aggiungine uno nuovo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
          {salonHours.map((item, idx) => (
            <div
              key={item.day}
              className="p-4 flex items-center justify-between hover:bg-gray-50 transition"
            >
              <div>
                <div className="font-bold text-xs text-gray-800">{item.day}</div>
                <div className="text-[11px] text-gray-400 font-mono mt-0.5">{item.hours}</div>
              </div>
              <input
                type="checkbox"
                checked={item.isOpen}
                onChange={() => {
                  const updated = [...salonHours];
                  updated[idx].isOpen = !updated[idx].isOpen;
                  if (!updated[idx].isOpen) updated[idx].hours = 'Chiuso';
                  else updated[idx].hours = '07:00 - 20:00';
                  setSalonHours(updated);
                }}
                className="w-5 h-5 text-tw-blue rounded focus:ring-0 cursor-pointer"
              />
            </div>
          ))}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
            <Clock className="w-10 h-10" />
          </div>
          <div className="text-xs text-gray-500">Scegli un elemento dall&apos;elenco</div>
        </div>
      </div>
    </div>
  );
};
