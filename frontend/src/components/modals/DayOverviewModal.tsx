'use client';

import React, { useState } from 'react';
import { Printer, X, Info } from 'lucide-react';
import { Appointment } from '@/types';

interface DayOverviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointments: Appointment[];
  onOpenFlashPromo: () => void;
}

export const DayOverviewModal: React.FC<DayOverviewModalProps> = ({
  isOpen,
  onClose,
  appointments,
  onOpenFlashPromo,
}) => {
  const [activeTab, setActiveTab] = useState<'incassi' | 'lista' | 'disdette'>('incassi');
  const [timeFilter, setTimeFilter] = useState<'oggi' | 'domani' | '7giorni'>('oggi');

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-stretch sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="relative w-full max-w-4xl bg-white sm:rounded-2xl shadow-2xl overflow-hidden sm:border border-gray-100 animate-in fade-in zoom-in-95 duration-200 flex flex-col h-full sm:h-auto sm:max-h-[92vh]">
        {/* Top Header */}
        <div className="relative px-4 sm:px-8 py-4 sm:py-5 border-b border-gray-100 flex items-center justify-center shrink-0">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            PANORAMICA DEL GIORNO
          </h2>
          <div className="absolute right-3 sm:right-6 flex items-center gap-2 sm:gap-3 text-gray-500">
            <button
              onClick={() => window.print()}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              title="Stampa report"
            >
              <Printer className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 hover:bg-gray-100 rounded-lg transition"
              title="Chiudi"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Sub-tabs Header */}
        <div className="flex sm:justify-center border-b border-gray-100 text-xs font-semibold overflow-x-auto no-scrollbar shrink-0">
          <button
            onClick={() => setActiveTab('incassi')}
            className={`px-4 sm:px-6 py-3 border-b-2 transition shrink-0 whitespace-nowrap ${
              activeTab === 'incassi'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            INCASSI PREVISTI
          </button>
          <button
            onClick={() => setActiveTab('lista')}
            className={`px-4 sm:px-6 py-3 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'lista'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>LISTA APPUNTAMENTI</span>
            <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] flex items-center justify-center">
              {appointments.length}
            </span>
          </button>
          <button
            onClick={() => setActiveTab('disdette')}
            className={`px-4 sm:px-6 py-3 border-b-2 transition shrink-0 whitespace-nowrap flex items-center gap-1.5 ${
              activeTab === 'disdette'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <span>DISDETTE E NO-SHOWS</span>
            <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] flex items-center justify-center">
              0
            </span>
          </button>
        </div>

        {/* Filter Bar */}
        <div className="px-4 sm:px-8 py-3.5 bg-gray-50/70 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 text-xs shrink-0">
          <div className="flex flex-wrap items-center gap-x-6 gap-y-2">
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="radio"
                name="timeFilter"
                checked={timeFilter === 'oggi'}
                onChange={() => setTimeFilter('oggi')}
                className="w-4 h-4 text-tw-blue focus:ring-0"
              />
              <span>Oggi</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="radio"
                name="timeFilter"
                checked={timeFilter === 'domani'}
                onChange={() => setTimeFilter('domani')}
                className="w-4 h-4 text-tw-blue focus:ring-0"
              />
              <span>Domani</span>
            </label>
            <label className="flex items-center gap-2 cursor-pointer font-medium text-gray-700">
              <input
                type="radio"
                name="timeFilter"
                checked={timeFilter === '7giorni'}
                onChange={() => setTimeFilter('7giorni')}
                className="w-4 h-4 text-tw-blue focus:ring-0"
              />
              <span>Prossimi 7 Giorni</span>
            </label>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-gray-400 font-medium uppercase text-[10px] tracking-wider">
              CONFRONTA CON:
            </span>
            <select className="border border-gray-200 rounded-lg px-3 py-1 bg-white text-gray-700 text-xs focus:ring-1 focus:ring-tw-blue">
              <option>Scegli</option>
              <option>Stesso giorno settimana scorsa</option>
              <option>Media mensile</option>
            </select>
          </div>
        </div>

        {/* Tab Content */}
        <div className="p-4 sm:p-8 overflow-y-auto flex-1 min-h-0">
          {activeTab === 'incassi' && (
            <div>
              {/* 4 Cards Grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-x-4 gap-y-8 md:divide-x divide-gray-100">
                {/* 1. Prenotazioni */}
                <div className="px-4 first:pl-0 flex flex-col justify-between h-56">
                  <div>
                    <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                      APPUNTAMENTI
                    </span>
                    <div className="mt-4 text-3xl font-light text-gray-900">
                      {appointments.length}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">Prenotazioni</div>
                  </div>

                  <div className="mt-auto">
                    {/* Yellow progress bar */}
                    <div className="h-1.5 w-full bg-yellow-400 rounded-full mb-3" />
                    <div className="flex justify-between text-[11px] text-gray-600 font-medium">
                      <span>40% Online</span>
                      <span>60% Offline</span>
                    </div>
                  </div>
                </div>

                {/* 2. Ore Lavorate */}
                <div className="px-4 flex flex-col items-center justify-between h-56 text-center">
                  <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                    ORE LAVORATE
                  </span>
                  <div className="relative w-28 h-28 flex items-center justify-center my-auto">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#F1F5F9"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#3584F6"
                        strokeWidth="8"
                        strokeDasharray={289}
                        strokeDashoffset={289 * (1 - 0.67)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-lg font-normal text-gray-800">67%</span>
                      <span className="text-[9px] text-gray-400">Ore occupate</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-tw-blue" />
                    <span>8 ore lavorabili</span>
                  </div>
                </div>

                {/* 3. Appuntamenti % */}
                <div className="px-4 flex flex-col items-center justify-between h-56 text-center">
                  <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                    APPUNTAMENTI
                  </span>
                  <div className="relative w-28 h-28 flex items-center justify-center my-auto">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#F1F5F9"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#3584F6"
                        strokeWidth="8"
                        strokeDasharray={289}
                        strokeDashoffset={289 * (1 - 0.75)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-lg font-normal text-gray-800">75%</span>
                      <span className="text-[9px] text-gray-400">Prenotato</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-tw-blue" />
                    <span>19 Appuntamenti potenziali</span>
                  </div>
                </div>

                {/* 4. Ricavi */}
                <div className="px-4 last:pr-0 flex flex-col items-center justify-between h-56 text-center">
                  <span className="text-[10px] font-bold tracking-wider text-gray-500 uppercase">
                    RICAVI
                  </span>
                  <div className="relative w-28 h-28 flex items-center justify-center my-auto">
                    <svg className="w-28 h-28 transform -rotate-90">
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#F1F5F9"
                        strokeWidth="8"
                        fill="transparent"
                      />
                      <circle
                        cx="56"
                        cy="56"
                        r="46"
                        stroke="#3584F6"
                        strokeWidth="8"
                        strokeDasharray={289}
                        strokeDashoffset={289 * (1 - 0.72)}
                        strokeLinecap="round"
                        fill="transparent"
                      />
                    </svg>
                    <div className="absolute flex flex-col items-center">
                      <span className="text-lg font-normal text-gray-800">€ 478</span>
                      <span className="text-[9px] text-gray-400">Ricavo previsto</span>
                    </div>
                  </div>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1">
                    <Info className="w-3 h-3 text-tw-blue" />
                    <span>€ 650 Potenziale</span>
                  </div>
                </div>
              </div>

              {/* Bottom promo link */}
              <div className="mt-8 pt-6 border-t border-gray-100 text-center">
                <span className="text-xs text-gray-500">
                  Ottimizza i tuoi appuntamenti con l&apos;aiuto delle{' '}
                </span>
                <button
                  onClick={() => {
                    onClose();
                    onOpenFlashPromo();
                  }}
                  className="text-xs text-tw-blue font-semibold hover:underline"
                >
                  Promo Flash
                </button>
              </div>
            </div>
          )}

          {activeTab === 'lista' && (
            <div className="space-y-3">
              {appointments.length === 0 ? (
                <div className="text-center py-12 text-sm text-gray-400">
                  Nessun appuntamento per la giornata di oggi
                </div>
              ) : (
                appointments.map((app) => (
                  <div
                    key={app.id}
                    className="flex items-center justify-between p-3.5 bg-gray-50 rounded-xl border border-gray-100 hover:border-tw-blue/40 transition"
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-xs font-bold text-tw-blue px-2.5 py-1 bg-white border border-gray-200 rounded-lg">
                        {app.startTime}
                      </span>
                      <div>
                        <div className="text-xs font-bold text-gray-800">{app.clientName}</div>
                        <div className="text-[11px] text-gray-500">
                          {app.serviceName} • {app.durationFormatted} con {app.staffName}
                        </div>
                      </div>
                    </div>
                    <span className="text-[10px] font-semibold uppercase px-2 py-0.5 rounded bg-emerald-100 text-emerald-800">
                      {app.source}
                    </span>
                  </div>
                ))
              )}
            </div>
          )}

          {activeTab === 'disdette' && (
            <div className="text-center py-12 text-sm text-gray-400">
              Nessun appuntamento disdetto o no-show per la giornata selezionata.
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
