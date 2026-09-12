'use client';

import React, { useState } from 'react';
import { Search, Plus, Trash2, Clock, Edit2 } from 'lucide-react';
import { StaffMember, ServiceItem } from '@/types';

interface StaffViewProps {
  staffList: StaffMember[];
  services: ServiceItem[];
}

export const StaffView: React.FC<StaffViewProps> = ({ staffList, services }) => {
  const [selectedStaffId, setSelectedStaffId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [serviceSearch, setServiceSearch] = useState('');

  const effectiveStaffId = selectedStaffId || staffList[0]?.id || '';
  const currentStaff = staffList.find((s) => s.id === effectiveStaffId) || staffList[0];

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-72 border-r border-gray-200 flex flex-col bg-white">
        <div className="p-4 border-b border-gray-100">
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cerca collaboratore"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => alert('Aggiungi collaboratore')}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Staff list */}
        <div className="p-2 space-y-1 overflow-y-auto flex-1">
          {staffList.map((staff) => (
            <div
              key={staff.id}
              onClick={() => setSelectedStaffId(staff.id)}
              className={`flex items-center justify-between p-3 rounded-xl cursor-pointer transition ${
                selectedStaffId === staff.id
                  ? 'bg-tw-blue-light text-tw-blue font-bold'
                  : 'hover:bg-gray-50 text-gray-700'
              }`}
            >
              <span className="text-xs">{staff.name}</span>
              <div className="flex items-center gap-2 text-gray-400 text-xs">
                <span>{staff.utilizationPercentage}%</span>
                <span>✂</span>
                <span>≡</span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Main Staff Details Panel */}
      <div className="flex-1 overflow-y-auto p-8 bg-tw-canvas space-y-6">
        {/* Top Header of Detail Panel */}
        <div className="flex items-center justify-between max-w-4xl mx-auto">
          <button
            onClick={() => alert('Elimina')}
            className="text-xs font-semibold text-red-500 hover:text-red-700 flex items-center gap-1 uppercase"
          >
            <Trash2 className="w-4 h-4" />
            <span>ELIMINA</span>
          </button>

          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-widest">
            {currentStaff.name}
          </h2>

          <div className="flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
              RECEPTIONIST
            </span>
            <input
              type="checkbox"
              checked={currentStaff.isReceptionist}
              readOnly
              className="w-4 h-4 text-tw-blue rounded"
            />
          </div>
        </div>

        <div className="max-w-4xl mx-auto space-y-6">
          {/* Card 1: Dati Personali */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              DATI PERSONALI
            </div>

            <div className="flex items-center gap-6">
              <div className="flex flex-col items-center gap-2">
                <div className="relative w-20 h-20 rounded-2xl bg-gray-100 overflow-hidden border border-gray-200">
                  <img
                    src="https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=300&auto=format&fit=crop&q=80"
                    alt={currentStaff.name}
                    className="w-full h-full object-cover"
                  />
                  <button className="absolute top-1 right-1 w-4 h-4 bg-red-500 text-white rounded-full flex items-center justify-center text-[10px]">
                    ×
                  </button>
                </div>
                <button className="text-[10px] text-tw-blue font-bold hover:underline flex items-center gap-1 uppercase">
                  <span>↑</span> CARICA IMMAGINE
                </button>
              </div>

              <div className="flex-1 grid grid-cols-2 gap-4">
                <input
                  type="text"
                  value={currentStaff.name}
                  readOnly
                  placeholder="Nome"
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800 font-semibold"
                />
                <input
                  type="text"
                  value={currentStaff.surname}
                  readOnly
                  placeholder="Cognome"
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800"
                />
                <input
                  type="text"
                  value={currentStaff.phone}
                  readOnly
                  placeholder="Telefono"
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800"
                />
                <input
                  type="email"
                  value={currentStaff.email}
                  readOnly
                  placeholder="Email"
                  className="bg-white border border-gray-200 rounded-full px-4 py-2 text-xs text-gray-800"
                />
              </div>
            </div>
          </div>

          {/* Card 2: Commissioni */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              COMMISSIONI
            </div>
            <p className="text-xs text-gray-500 text-center max-w-xl mx-auto leading-relaxed">
              Calcolare manualmente le commissioni del team può essere complicato, quindi
              impostarle in anticipo può far risparmiare tempo quando si calcola le loro commissioni
              alla fine del mese. Utilizza il report Analisi Profittabilità per tenere traccia delle
              commissioni dei vostri team.{' '}
              <button className="text-tw-blue font-bold uppercase hover:underline ml-1">
                VAI AL REPORT
              </button>
            </p>
            <div className="flex items-center justify-center gap-3 pt-2">
              <span className="text-[10px] font-bold text-gray-400 uppercase">COMMISSIONI (%)</span>
              <input
                type="number"
                value={currentStaff.commissionPercentage}
                readOnly
                className="w-24 border border-gray-200 rounded-full px-4 py-1 text-center text-xs font-bold"
              />
            </div>
          </div>

          {/* Card 3: Orari & Ferie/Permessi */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs grid grid-cols-2 divide-x divide-gray-200">
            {/* Left: Orari */}
            <div className="pr-6 space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                ORARI (ORARIO 1)
              </div>
              <div className="space-y-2 text-xs">
                {Object.entries(currentStaff.workingHours).map(([day, hrs]) => (
                  <div key={day} className="flex justify-between py-1 border-b border-gray-50">
                    <span className="font-semibold text-gray-700">{day}</span>
                    <span className="text-gray-600 font-mono">{hrs}</span>
                  </div>
                ))}
              </div>
              <div className="flex justify-center pt-2">
                <button className="px-6 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold rounded-full transition uppercase">
                  GESTISCI
                </button>
              </div>
            </div>

            {/* Right: Ferie e Permessi */}
            <div className="pl-6 space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                FERIE E PERMESSI
              </div>
              <div className="space-y-2 text-xs">
                {currentStaff.vacations.map((vac) => (
                  <div
                    key={vac.id}
                    className="flex items-center justify-between py-1 border-b border-gray-50"
                  >
                    <span className="font-semibold text-gray-700">{vac.date}</span>
                    <div className="flex items-center gap-2">
                      <span className="text-gray-600 font-mono">{vac.hours}</span>
                      <Trash2 className="w-3.5 h-3.5 text-red-400 hover:text-red-600 cursor-pointer" />
                    </div>
                  </div>
                ))}
              </div>
              <div className="flex flex-col items-center gap-2 pt-2">
                <button className="text-[11px] text-tw-blue font-semibold hover:underline">
                  Vedi eventi passati
                </button>
                <button className="px-6 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold rounded-full transition uppercase">
                  CREA
                </button>
              </div>
            </div>
          </div>

          {/* Card 4: Servizi Attivi */}
          <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <div className="relative w-64">
                <input
                  type="text"
                  placeholder="Quale servizio vuoi ..."
                  value={serviceSearch}
                  onChange={(e) => setServiceSearch(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
              </div>

              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                SERVIZI ATTIVI
              </span>

              <button
                onClick={() => alert('Aggiungi servizio a collaboratore')}
                className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of active services */}
            <div className="divide-y divide-gray-100">
              {services.map((srv) => (
                <div key={srv.id} className="py-3 flex items-center justify-between text-xs">
                  <span className="font-semibold text-gray-800">{srv.name}</span>
                  <div className="flex items-center gap-6">
                    <span className="font-bold text-gray-800">€ {srv.price.toFixed(2)}</span>
                    <span className="text-gray-500 flex items-center gap-1 font-mono">
                      <Clock className="w-3 h-3 text-gray-400" />
                      {srv.duration}
                    </span>
                    <span className="bg-yellow-100 text-yellow-800 font-bold text-[9px] px-2 py-0.5 rounded-full uppercase">
                      ONLINE
                    </span>
                    <Edit2 className="w-3.5 h-3.5 text-gray-400 hover:text-tw-blue cursor-pointer" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
