'use client';

import React, { useState } from 'react';
import { Package, Search, Plus, Smile } from 'lucide-react';

interface MagazzinoViewProps {
  subSection: 'prodotti' | 'ordini' | 'scadenzario';
}

export const MagazzinoView: React.FC<MagazzinoViewProps> = ({ subSection }) => {
  const [activeTab, setActiveTab] = useState<'inviati' | 'bolla' | 'in-scadenza' | 'passate'>('inviati');
  const [searchQuery, setSearchQuery] = useState('');

  if (subSection === 'prodotti') {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas select-none">
        <div className="flex flex-col items-center text-center space-y-4 max-w-sm">
          <div className="w-14 h-14 rounded-full bg-blue-50 text-tw-blue flex items-center justify-center">
            <Smile className="w-8 h-8" />
          </div>
          <h2 className="text-xl font-bold text-gray-900">Benvenuti nel vostro magazzino!</h2>
          <p className="text-xs text-gray-500 leading-relaxed">
            In questa sezione puoi gestire tutti i tuoi prodotti selezionandoli dal catalogo
          </p>
          <div className="pt-2">
            <button
              onClick={() => alert('Aggiungi nuovo prodotto')}
              className="px-6 py-2.5 bg-tw-blue hover:bg-tw-blue-hover text-white text-xs font-bold rounded-xl shadow-sm transition"
            >
              Aggiungi nuovo prodotto
            </button>
          </div>
        </div>
      </div>
    );
  }

  if (subSection === 'ordini') {
    return (
      <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
        <div className="w-full md:w-80 md:border-r border-gray-200 flex flex-col bg-white">
          <div className="flex border-b border-gray-200 text-xs font-semibold">
            <button
              onClick={() => setActiveTab('inviati')}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                activeTab === 'inviati'
                  ? 'border-tw-blue text-tw-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              INVIATI
            </button>
            <button
              onClick={() => setActiveTab('bolla')}
              className={`flex-1 py-3 text-center border-b-2 transition ${
                activeTab === 'bolla'
                  ? 'border-tw-blue text-tw-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              BOLLA
            </button>
          </div>
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cerca ordine"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
              </div>
              <button
                onClick={() => alert('Nuovo ordine')}
                className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-tw-canvas">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Package className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Scegli un elemento dall&apos;elenco, oppure{' '}
              <button
                onClick={() => alert('Crea nuovo ordine')}
                className="text-tw-blue font-medium hover:underline"
              >
                creane uno nuovo
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Scadenzario
  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      <div className="w-full md:w-80 md:border-r border-gray-200 flex flex-col bg-white">
        <div className="flex border-b border-gray-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('in-scadenza')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'in-scadenza'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            RATE IN SCADENZA
          </button>
          <button
            onClick={() => setActiveTab('passate')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'passate'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            RATE PASSATE
          </button>
        </div>
        <div className="p-4 flex-1 flex flex-col">
          <div className="relative flex-1">
            <input
              type="text"
              placeholder="Cerca ordine"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
          </div>
        </div>
      </div>

      <div className="hidden md:flex flex-1 flex-col items-center justify-center p-8 bg-tw-canvas">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
            <Package className="w-10 h-10" />
          </div>
          <div className="text-xs text-gray-500">Scegli un elemento dall&apos;elenco</div>
        </div>
      </div>
    </div>
  );
};
