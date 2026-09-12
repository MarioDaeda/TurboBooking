'use client';

import React, { useState } from 'react';
import { Scissors, Search, Plus, Trash2, Check, Info } from 'lucide-react';
import { ServiceItem } from '@/types';

interface TrattamentiViewProps {
  services: ServiceItem[];
}

export const TrattamentiView: React.FC<TrattamentiViewProps> = ({ services }) => {
  const [activeTab, setActiveTab] = useState<'trattamenti' | 'pacchetto'>('trattamenti');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedServiceId, setSelectedServiceId] = useState<string | null>(null);

  const effectiveSelectedId = selectedServiceId || services[0]?.id || null;
  const selectedService = services.find((s) => s.id === effectiveSelectedId) || services[0];

  const filteredServices = services.filter(
    (srv) =>
      srv.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      srv.category.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const groupedServices: { [category: string]: ServiceItem[] } = {};
  filteredServices.forEach((srv) => {
    if (!groupedServices[srv.category]) {
      groupedServices[srv.category] = [];
    }
    groupedServices[srv.category].push(srv);
  });

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="flex border-b border-gray-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('trattamenti')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'trattamenti'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            TRATTAMENTI
          </button>
          <button
            onClick={() => setActiveTab('pacchetto')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'pacchetto'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            PACCHETTO
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cerca servizio"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => alert('Aggiungi trattamento')}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Grouped Services List */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {Object.entries(groupedServices).map(([category, items]) => (
            <div key={category} className="space-y-1.5">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                {category}
              </div>
              <div className="space-y-1">
                {items.map((srv) => (
                  <div
                    key={srv.id}
                    onClick={() => setSelectedServiceId(srv.id)}
                    className={`flex items-center justify-between p-2.5 rounded-xl cursor-pointer transition ${
                      selectedServiceId === srv.id
                        ? 'bg-tw-blue-light text-tw-blue font-semibold'
                        : 'hover:bg-gray-50 text-gray-700'
                    }`}
                  >
                    <div className="flex items-center gap-2 truncate">
                      <span
                        className="w-2 h-2 rounded-full flex-shrink-0"
                        style={{ backgroundColor: srv.categoryColor }}
                      />
                      <span className="text-xs truncate">{srv.name}</span>
                    </div>
                    <span className="text-[11px] text-gray-400 font-mono flex-shrink-0">
                      {srv.duration} / {srv.price}€
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Treatment Details Panel */}
      <div className="flex-1 overflow-y-auto p-8 bg-tw-canvas">
        {selectedService ? (
          <div key={selectedService.id} className="max-w-3xl mx-auto space-y-6">
            {/* Top Bar */}
            <div className="flex items-center justify-between">
              <button
                onClick={() => alert('Elimina')}
                className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 uppercase"
              >
                <Trash2 className="w-4 h-4" />
                <span>ELIMINA</span>
              </button>

              <div className="flex items-center gap-1 text-emerald-600 font-bold text-xs uppercase tracking-wider">
                <span>SALVATO: 23/06/2026</span>
                <Check className="w-4 h-4" />
              </div>
            </div>

            {/* Card 1: General details */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-5">
              <div className="space-y-1">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  NOME DEL TRATTAMENTO
                </span>
                <input
                  type="text"
                  defaultValue={selectedService.name}
                  className="w-full text-base font-bold text-gray-800 border border-gray-200 rounded-xl px-4 py-2"
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    NOME ABBREVIATO
                  </span>
                  <input
                    type="text"
                    defaultValue={selectedService.shortname}
                    className="w-full text-sm font-semibold text-gray-800 border border-gray-200 rounded-xl px-4 py-2"
                  />
                </div>
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    COLORE
                  </span>
                  <div className="flex items-center gap-2 border border-gray-200 rounded-xl px-4 py-2">
                    <span
                      className="w-5 h-5 rounded-full"
                      style={{ backgroundColor: selectedService.categoryColor }}
                    />
                    <span className="text-xs text-gray-600 font-medium capitalize">
                      {selectedService.category.toLowerCase()}
                    </span>
                  </div>
                </div>
              </div>

              {/* Info box */}
              <div className="p-3.5 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-gray-600 leading-relaxed">
                <Info className="w-4 h-4 text-tw-blue flex-shrink-0 mt-0.5" />
                <span>
                  Il nome abbreviato e il colore scelto saranno associati al trattamento nella tua
                  agenda ogni volta che prenderai un appuntamento, così sarà più facile per te
                  riconoscerlo rapidamente.
                </span>
              </div>

              {/* Toggle Scelta Veloce */}
              <div className="flex items-center justify-between pt-2 border-t border-gray-100">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  AGGIUNGI A SCELTA VELOCE
                </span>
                <input
                  type="checkbox"
                  defaultChecked={selectedService.isQuickChoice}
                  className="w-5 h-5 text-tw-blue rounded"
                />
              </div>
            </div>

            {/* Card 2: Prezzi e Durata */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                PREZZI E DURATA
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    PREZZO
                  </span>
                  <div className="relative flex items-center">
                    <span className="absolute left-4 text-gray-400 text-xs font-semibold">€</span>
                    <input
                      type="number"
                      defaultValue={selectedService.price}
                      className="w-full pl-8 pr-4 py-2 border border-gray-200 rounded-xl text-xs font-bold text-gray-800"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    DURATA
                  </span>
                  <select
                    defaultValue={selectedService.duration}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white"
                  >
                    <option value="00:15">00:15</option>
                    <option value="00:30">00:30</option>
                    <option value="00:45">00:45</option>
                    <option value="01:00">01:00</option>
                    <option value="01:15">01:15</option>
                    <option value="01:30">01:30</option>
                    <option value="01:45">01:45</option>
                    <option value="02:00">02:00</option>
                    <option value="02:15">02:15</option>
                    <option value="02:30">02:30</option>
                    <option value="02:45">02:45</option>
                    <option value="03:00">03:00</option>
                    <option value="03:30">03:30</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    TEMPO DI POSA
                  </span>
                  <select
                    defaultValue={selectedService.posaDuration || '0:00'}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs font-semibold text-gray-800 bg-white"
                  >
                    <option value="0:00">0:00</option>
                    <option value="0:15">0:15</option>
                    <option value="0:30">0:30</option>
                    <option value="0:45">0:45</option>
                    <option value="1:00">1:00</option>
                  </select>
                </div>
              </div>

              {/* Trattamento Obbligatorio Correlato */}
              <div className="flex items-center justify-between p-3 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-xs font-semibold text-gray-700 uppercase tracking-wide">
                  TRATTAMENTO OBBLIGATORIO CORRELATO
                </span>
                <button
                  onClick={() => alert('Aggiungi servizio correlato')}
                  className="px-4 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold rounded-full transition uppercase"
                >
                  AGGIUNGI SERVIZIO +
                </button>
              </div>

              {/* Toggles */}
              <div className="space-y-4 pt-2 border-t border-gray-100 text-xs font-semibold text-gray-700 uppercase">
                <label className="flex items-center justify-between cursor-pointer">
                  <span>IL SERVIZIO HA VARIANTI DI PREZZO O DURATA</span>
                  <input
                    type="checkbox"
                    defaultChecked={selectedService.hasVariants}
                    className="w-5 h-5 text-tw-blue rounded"
                  />
                </label>
                <label className="flex items-center justify-between cursor-pointer">
                  <span>IL SERVIZIO RICHIEDE UN TEMPO DI SANIFICAZIONE</span>
                  <input
                    type="checkbox"
                    defaultChecked={selectedService.sanificazione}
                    className="w-5 h-5 text-tw-blue rounded"
                  />
                </label>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4 h-full">
            <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Scissors className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Seleziona un servizio dall&apos;elenco o aggiungine uno nuovo
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
