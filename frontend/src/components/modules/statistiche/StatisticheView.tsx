'use client';

import React from 'react';
import { Info, Filter } from 'lucide-react';
import { mockCorrispettivi } from '@/data/mockData';

interface StatisticheViewProps {
  subSection:
    | 'andamento'
    | 'azienda'
    | 'corrispettivi'
    | 'collaboratori'
    | 'clienti'
    | 'magazzino'
    | 'inventario';
}

export const StatisticheView: React.FC<StatisticheViewProps> = ({ subSection }) => {
  if (subSection === 'corrispettivi') {
    return (
      <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto p-4 md:p-8 select-none">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          {/* Top Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  PERIODO
                </span>
                <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
                  <option>DA 8/1/2026 A 8/31/2026</option>
                </select>
              </div>

              <button className="flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-tw-blue uppercase">
                <Filter className="w-3.5 h-3.5" />
                <span>PERSONALIZZA COLONNE</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  SETTORE
                </span>
                <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
                  <option>Tutti</option>
                </select>
              </div>

              <button
                onClick={() => alert('Download corrispettivi CSV')}
                className="px-4 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold uppercase rounded-full shadow-xs transition"
              >
                ESPORTA CSV
              </button>
            </div>
          </div>

          {/* Table Container */}
          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-4 font-bold">GG</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. LORDO</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. NETTO</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. SERVIZI</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. RIVENDITA</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. PROMOZIONI</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. FATTURE</th>
                  <th className="py-4 px-4 font-bold text-right">NUM. RICEVUTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {mockCorrispettivi.map((row) => (
                  <tr
                    key={row.gg}
                    className={`hover:bg-gray-50 transition ${
                      row.gg === 'Totale' ? 'font-bold bg-blue-50/30 text-gray-900 text-sm' : ''
                    }`}
                  >
                    <td className="py-3.5 px-4">{row.gg}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impLordo.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impNetto.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impServizi.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impRivendita.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impPromozioni.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">€ {row.impFatture.toFixed(2)}</td>
                    <td className="py-3.5 px-4 text-right">{row.numRicevute}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  // Default: Analisi Andamento
  return (
    <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto p-4 md:p-8 select-none">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Filter bar */}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              PERIODO
            </span>
            <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
              <option>DA 8/1/2026 A 8/31/2026</option>
            </select>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              SETTORE
            </span>
            <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs">
              <option>Tutti</option>
            </select>
          </div>
        </div>

        {/* Top 4 Cards Row */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {[
            { label: 'RICAVI TOTALI', val: '€ 2.390', spark: 'w-full h-8 bg-blue-50/50 rounded' },
            { label: 'SERVIZI', val: '€ 2.170', spark: 'w-full h-8 bg-blue-50/50 rounded' },
            { label: 'PRODOTTI', val: '€ 220', spark: 'w-full h-8 bg-blue-50/50 rounded' },
            { label: 'PROMOZIONI', val: '€ 20', spark: 'w-full h-8 bg-blue-50/50 rounded' },
          ].map((item) => (
            <div
              key={item.label}
              className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3"
            >
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{item.label}</span>
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-2xl font-light text-gray-900">{item.val}</div>
              {/* Sparkline curve mockup */}
              <div className="h-6 w-full flex items-end">
                <svg className="w-full h-6 text-tw-blue" fill="none" viewBox="0 0 100 24">
                  <path
                    d="M 0 18 Q 25 12, 50 15 T 100 8"
                    stroke="#3584F6"
                    strokeWidth="2"
                    fill="none"
                  />
                </svg>
              </div>
            </div>
          ))}
        </div>

        {/* Middle Stats Row */}
        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-y-4 md:divide-x divide-gray-100">
          <div className="pr-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">FICHE MEDIA</span>
            <div className="text-xl font-bold text-gray-800">€ 47,80</div>
          </div>
          <div className="px-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">SERVIZI PER FICHE</span>
            <div className="text-xl font-bold text-gray-800">1,4</div>
          </div>
          <div className="px-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">% RIVENDITA SU PRESENZE</span>
            <div className="text-xl font-bold text-gray-800">12%</div>
          </div>
          <div className="pl-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">PRESENZE TOTALI</span>
            <div className="text-xl font-bold text-gray-800">50</div>
          </div>
        </div>

        {/* Charts Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-700 uppercase">PRESENZE</span>
              <div className="flex items-center gap-4 text-[10px] text-gray-500 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-tw-blue" />
                  Periodo selezionato
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Periodo di confronto
                </span>
              </div>
            </div>
            <div className="h-44 border-b border-l border-gray-200 flex items-end p-2 gap-4">
              <div className="w-8 bg-tw-blue/80 h-3/4 rounded-t" />
              <div className="w-8 bg-tw-blue/80 h-1/2 rounded-t" />
              <div className="w-8 bg-tw-blue/80 h-5/6 rounded-t" />
              <div className="w-8 bg-tw-blue/80 h-2/3 rounded-t" />
            </div>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs font-bold text-gray-700 uppercase">FATTURATO</span>
              <div className="flex items-center gap-4 text-[10px] text-gray-500 font-semibold">
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-tw-blue" />
                  Periodo selezionato
                </span>
                <span className="flex items-center gap-1">
                  <span className="w-2 h-2 rounded-full bg-amber-400" />
                  Periodo di confronto
                </span>
              </div>
            </div>
            <div className="h-44 border-b border-l border-gray-200 flex items-end p-2 gap-4">
              <div className="w-8 bg-emerald-500/80 h-2/3 rounded-t" />
              <div className="w-8 bg-emerald-500/80 h-3/4 rounded-t" />
              <div className="w-8 bg-emerald-500/80 h-1/2 rounded-t" />
              <div className="w-8 bg-emerald-500/80 h-full rounded-t" />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
