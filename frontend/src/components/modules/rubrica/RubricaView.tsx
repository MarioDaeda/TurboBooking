'use client';

import React, { useState } from 'react';
import { Users, Search, Plus, ShieldCheck, AlertCircle, Calendar } from 'lucide-react';
import { Client } from '@/types';

interface RubricaViewProps {
  clients: Client[];
  onAddClient?: () => void;
}

export const RubricaView: React.FC<RubricaViewProps> = ({ clients }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);

  const filteredClients = clients.filter((c) =>
    c.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const selectedClient = clients.find((c) => c.id === selectedClientId);

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col justify-between bg-white">
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          {/* Search bar & Add button */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cerca cliente"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => alert('Nuovo cliente')}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* List or hint */}
          {searchQuery.length < 3 ? (
            <div className="text-center py-10 px-4 text-xs text-gray-400">
              <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Digita almeno 3 caratteri per effettuare la ricerca.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {filteredClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`p-3 rounded-xl cursor-pointer transition ${
                    selectedClientId === client.id
                      ? 'bg-tw-blue-light text-tw-blue'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="font-bold text-xs">{client.name}</div>
                  <div className="text-[11px] text-gray-500 mt-0.5">{client.phone}</div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Export Bar */}
        <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50">
          <span>Export as</span>
          <select className="border border-gray-200 rounded-lg px-2 py-0.5 text-xs bg-white">
            <option>CSV</option>
            <option>Excel</option>
          </select>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas overflow-y-auto">
        {selectedClient ? (
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedClient.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">{selectedClient.phone} • {selectedClient.email}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedClient.hasPrivacyConsent ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Consenso privacy attivo
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-red-700 bg-red-50 px-3 py-1 rounded-full border border-red-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Nessun consenso privacy
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  VISITE TOTALI
                </span>
                <div className="text-2xl font-bold text-gray-800 mt-1">{selectedClient.totalVisits}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  ULTIMA VISITA
                </span>
                <div className="text-base font-semibold text-gray-800 mt-1.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{selectedClient.lastVisit || 'Nessuna'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Note Tecniche / Preferenze
              </span>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
                {selectedClient.notes || 'Nessuna nota tecnica registrata.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Users className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Seleziona un cliente dall&apos;elenco o{' '}
              <button
                onClick={() => alert('Aggiungi nuovo cliente')}
                className="text-tw-blue font-medium hover:underline"
              >
                aggiungine uno nuovo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
