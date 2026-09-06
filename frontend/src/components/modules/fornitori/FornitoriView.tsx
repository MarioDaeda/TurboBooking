'use client';

import React, { useState } from 'react';
import { Truck, Search, Plus } from 'lucide-react';
import { mockSuppliers } from '@/data/mockData';

interface FornitoriViewProps {
  subSection: 'fornitori' | 'produttori' | 'spedizioni';
}

export const FornitoriView: React.FC<FornitoriViewProps> = ({ subSection }) => {
  const [activeTab, setActiveTab] = useState<'fornitori' | 'produttori'>('fornitori');
  const [searchQuery, setSearchQuery] = useState('');

  if (subSection === 'spedizioni') {
    return (
      <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
        <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
          <div className="p-4 flex-1 flex flex-col">
            <div className="flex items-center gap-2 mb-3">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cerca opzione"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
              </div>
              <button
                onClick={() => alert('Aggiungi opzione spedizione')}
                className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>

        <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Truck className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Scegli un elemento dall&apos;elenco, oppure{' '}
              <button
                onClick={() => alert('Crea nuova opzione')}
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

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        <div className="flex border-b border-gray-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('fornitori')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'fornitori'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            FORNITORI
          </button>
          <button
            onClick={() => setActiveTab('produttori')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'produttori'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            PRODUTTORI
          </button>
        </div>

        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder={activeTab === 'fornitori' ? 'Cerca Fornitore' : 'Cerca Produttore'}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => alert('Aggiungi fornitore')}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Suppliers list */}
        <div className="flex-1 overflow-y-auto divide-y divide-gray-100 p-2">
          {mockSuppliers
            .filter((s) => s.toLowerCase().includes(searchQuery.toLowerCase()))
            .map((supplier) => (
              <div
                key={supplier}
                className="p-3 text-xs font-semibold text-gray-700 flex items-center justify-between hover:bg-gray-50 rounded-xl cursor-pointer"
              >
                <span>{supplier}</span>
                <span className="text-gray-300">›</span>
              </div>
            ))}
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
        <div className="flex flex-col items-center justify-center text-center space-y-4">
          <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
            <Truck className="w-10 h-10" />
          </div>
          <div className="text-xs text-gray-500">
            Scegli un elemento dall&apos;elenco, oppure{' '}
            <button
              onClick={() => alert('Aggiungi')}
              className="text-tw-blue font-medium hover:underline"
            >
              creane uno nuovo
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
