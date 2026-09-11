'use client';

import React, { useState } from 'react';
import { Clock, Plus, Sun, Moon } from 'lucide-react';

interface DaySchedule {
  day: string;
  shortName: string;
  hours: string;
  isOpen: boolean;
  openTime: string;
  closeTime: string;
}

interface OrariViewProps {
  subSection: 'orari' | 'aperture' | 'chiusure';
  onSelectSubSection?: (sub: 'orari' | 'aperture' | 'chiusure') => void;
  salonHours?: DaySchedule[];
  onUpdateSalonHours?: (hours: DaySchedule[]) => void;
}

export const OrariView: React.FC<OrariViewProps> = ({
  subSection,
  onSelectSubSection,
  salonHours,
  onUpdateSalonHours,
}) => {
  const [activeTab, setActiveTab] = useState<'orari' | 'aperture' | 'chiusure'>(subSection);
  const [selectedDayIndex, setSelectedDayIndex] = useState<number>(2); // Default to Mercoledì

  const [localSalonHours, setLocalSalonHours] = useState<DaySchedule[]>([
    { day: 'Domenica', shortName: 'DOM', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
    { day: 'Lunedì', shortName: 'LUN', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
    { day: 'Martedì', shortName: 'MAR', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
    { day: 'Mercoledì', shortName: 'MER', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
    { day: 'Giovedì', shortName: 'GIO', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
    { day: 'Venerdì', shortName: 'VEN', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
    { day: 'Sabato', shortName: 'SAB', hours: '08:00 - 18:00', isOpen: true, openTime: '08:00', closeTime: '18:00' },
  ]);

  const currentSalonHours = salonHours || localSalonHours;

  const updateHours = (newHours: DaySchedule[]) => {
    if (onUpdateSalonHours) {
      onUpdateSalonHours(newHours);
    } else {
      setLocalSalonHours(newHours);
    }
  };

  const [extraOpenings, setExtraOpenings] = useState([
    { id: '1', date: '2026-12-20', title: 'Apertura Domenicale Natale', hours: '09:00 - 18:00' },
  ]);

  const [extraClosures, setExtraClosures] = useState([
    { id: '1', date: '2026-08-15', title: 'Ferragosto', reason: 'Festa Nazionale' },
    { id: '2', date: '2026-12-25', title: 'Natale', reason: 'Festività' },
  ]);

  // Keep activeTab in sync with incoming subSection prop
  React.useEffect(() => {
    setActiveTab(subSection);
  }, [subSection]);

  const handleTabChange = (newTab: 'orari' | 'aperture' | 'chiusure') => {
    setActiveTab(newTab);
    if (onSelectSubSection) {
      onSelectSubSection(newTab);
    }
  };

  const selectedDay = currentSalonHours[selectedDayIndex];

  const handleToggleDay = (idx: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const updated = [...currentSalonHours];
    const target = { ...updated[idx] };
    target.isOpen = !target.isOpen;
    target.hours = target.isOpen ? `${target.openTime} - ${target.closeTime}` : 'Chiuso';
    updated[idx] = target;
    updateHours(updated);
  };

  const handleTimeChange = (type: 'open' | 'close', value: string) => {
    const updated = [...currentSalonHours];
    const target = { ...updated[selectedDayIndex] };
    if (type === 'open') target.openTime = value;
    else target.closeTime = value;
    if (target.isOpen) {
      target.hours = `${target.openTime} - ${target.closeTime}`;
    }
    updated[selectedDayIndex] = target;
    updateHours(updated);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-none">
      {/* Sub-navigation bar inside Orari to switch directly without drawer */}
      <div className="bg-gray-50 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
        <div className="flex items-center gap-2">
          <button
            onClick={() => handleTabChange('orari')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === 'orari'
                ? 'bg-tw-blue text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            Orari Salone
          </button>
          <button
            onClick={() => handleTabChange('aperture')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === 'aperture'
                ? 'bg-tw-blue text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            Aperture Straordinarie
          </button>
          <button
            onClick={() => handleTabChange('chiusure')}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition ${
              activeTab === 'chiusure'
                ? 'bg-tw-blue text-white shadow-xs'
                : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200'
            }`}
          >
            Chiusure Straordinarie
          </button>
        </div>

        <span className="text-[11px] text-gray-400 font-medium">
          {activeTab === 'orari' && 'Orario settimanale ordinario'}
          {activeTab === 'aperture' && `${extraOpenings.length} aperture straordinarie programmate`}
          {activeTab === 'chiusure' && `${extraClosures.length} chiusure straordinarie impostate`}
        </span>
      </div>

      {/* 1. ORARI ORDINARI DEL SALONE */}
      {activeTab === 'orari' && (
        <div className="flex-1 flex h-full overflow-hidden">
          {/* Days List Sidebar */}
          <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
            <div className="p-3.5 bg-gray-50/50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
              Giorni della settimana
            </div>
            <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
              {currentSalonHours.map((item, idx) => {
                const isSelected = selectedDayIndex === idx;
                return (
                  <div
                    key={item.day}
                    onClick={() => setSelectedDayIndex(idx)}
                    className={`p-4 flex items-center justify-between cursor-pointer transition ${
                      isSelected
                        ? 'bg-blue-50/80 border-l-4 border-tw-blue'
                        : 'hover:bg-gray-50 border-l-4 border-transparent'
                    }`}
                  >
                    <div>
                      <div className={`font-bold text-xs ${isSelected ? 'text-tw-blue' : 'text-gray-800'}`}>
                        {item.day}
                      </div>
                      <div className="text-[11px] text-gray-400 font-mono mt-0.5">{item.hours}</div>
                    </div>

                    <button
                      type="button"
                      onClick={(e) => handleToggleDay(idx, e)}
                      className={`w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ${
                        item.isOpen ? 'bg-tw-blue justify-end' : 'bg-gray-300 justify-start'
                      }`}
                    >
                      <span className="bg-white w-4 h-4 rounded-full shadow-md block transform transition-transform" />
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Day Detail / Editor on Right */}
          <div className="flex-1 flex flex-col p-8 bg-tw-canvas overflow-y-auto">
            {selectedDay ? (
              <div className="max-w-xl mx-auto w-full bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-6">
                <div className="flex items-center justify-between border-b border-gray-100 pb-4">
                  <div>
                    <h2 className="text-lg font-bold text-gray-900">{selectedDay.day}</h2>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {selectedDay.isOpen
                        ? `Aperto: ${selectedDay.openTime} – ${selectedDay.closeTime}`
                        : 'Giorno di chiusura ordinaria'}
                    </p>
                  </div>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      selectedDay.isOpen
                        ? 'bg-green-100 text-green-700'
                        : 'bg-gray-100 text-gray-600'
                    }`}
                  >
                    {selectedDay.isOpen ? 'APERTO' : 'CHIUSO'}
                  </span>
                </div>

                {selectedDay.isOpen ? (
                  <div className="space-y-5">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <Sun className="w-3.5 h-3.5 text-amber-500" />
                          Orario di Apertura
                        </label>
                        <input
                          type="time"
                          value={selectedDay.openTime}
                          onChange={(e) => handleTimeChange('open', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold text-gray-700 flex items-center gap-1.5">
                          <Moon className="w-3.5 h-3.5 text-indigo-500" />
                          Orario di Chiusura
                        </label>
                        <input
                          type="time"
                          value={selectedDay.closeTime}
                          onChange={(e) => handleTimeChange('close', e.target.value)}
                          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm font-mono text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                        />
                      </div>
                    </div>

                    <div className="p-3 bg-blue-50/60 rounded-xl border border-blue-100 flex items-start gap-2.5 text-xs text-tw-blue">
                      <Clock className="w-4 h-4 flex-shrink-0 mt-0.5" />
                      <span>
                        Gli orari modificati verranno applicati all&apos;agenda e alle prenotazioni online del salone.
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="py-8 text-center space-y-3">
                    <div className="w-12 h-12 rounded-full bg-gray-100 mx-auto flex items-center justify-center text-gray-400">
                      <Clock className="w-6 h-6" />
                    </div>
                    <p className="text-xs text-gray-500">
                      Il salone è attualmente impostato come chiuso ogni {selectedDay.day}.
                    </p>
                    <button
                      onClick={(e) => handleToggleDay(selectedDayIndex, e)}
                      className="px-4 py-2 bg-tw-blue text-white text-xs font-bold rounded-lg hover:bg-blue-600 transition cursor-pointer"
                    >
                      Imposta come Giorno di Apertura
                    </button>
                  </div>
                )}
              </div>
            ) : (
              <div className="flex-1 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                  <Clock className="w-10 h-10" />
                </div>
                <div className="text-xs text-gray-500">Scegli un elemento dall&apos;elenco</div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 2. APERTURE STRAORDINARIE */}
      {activeTab === 'aperture' && (
        <div className="flex-1 flex h-full bg-white overflow-hidden">
          <div className="w-80 border-r border-gray-200 p-4 flex flex-col bg-white">
            <button
              onClick={() => {
                const date = prompt('Inserisci data (es. 2026-12-24):', '2026-12-24');
                if (date) {
                  setExtraOpenings((prev) => [
                    ...prev,
                    { id: String(Date.now()), date, title: 'Apertura Straordinaria', hours: '08:00 - 18:00' },
                  ]);
                }
              }}
              className="w-full py-2 border border-tw-blue text-tw-blue hover:bg-blue-50 text-[11px] font-bold uppercase rounded-full transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>AGGIUNGI APERTURA STRAORDINARIA</span>
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="mt-4 divide-y divide-gray-100 overflow-y-auto flex-1">
              {extraOpenings.map((item) => (
                <div key={item.id} className="py-3 px-1">
                  <div className="text-xs font-bold text-gray-800">{item.title}</div>
                  <div className="text-[11px] text-tw-blue font-mono mt-0.5">{item.date} • {item.hours}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                <Clock className="w-10 h-10" />
              </div>
              <div className="text-xs text-gray-500">
                Scegli un elemento dall&apos;elenco o{' '}
                <button
                  onClick={() => {
                    const date = prompt('Inserisci data:', '2026-12-24');
                    if (date) {
                      setExtraOpenings((prev) => [
                        ...prev,
                        { id: String(Date.now()), date, title: 'Apertura Straordinaria', hours: '08:00 - 18:00' },
                      ]);
                    }
                  }}
                  className="text-tw-blue font-medium hover:underline cursor-pointer"
                >
                  aggiungine uno nuovo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 3. CHIUSURE STRAORDINARIE */}
      {activeTab === 'chiusure' && (
        <div className="flex-1 flex h-full bg-white overflow-hidden">
          <div className="w-80 border-r border-gray-200 p-4 flex flex-col bg-white">
            <button
              onClick={() => {
                const date = prompt('Inserisci data di chiusura (es. 2026-08-16):', '2026-08-16');
                if (date) {
                  setExtraClosures((prev) => [
                    ...prev,
                    { id: String(Date.now()), date, title: 'Chiusura Straordinaria', reason: 'Ferie' },
                  ]);
                }
              }}
              className="w-full py-2 border border-tw-blue text-tw-blue hover:bg-blue-50 text-[11px] font-bold uppercase rounded-full transition flex items-center justify-center gap-1 cursor-pointer"
            >
              <span>AGGIUNGI CHIUSURA STRAORDINARIA</span>
              <Plus className="w-3.5 h-3.5" />
            </button>

            <div className="mt-4 divide-y divide-gray-100 overflow-y-auto flex-1">
              {extraClosures.map((item) => (
                <div key={item.id} className="py-3 px-1">
                  <div className="text-xs font-bold text-gray-800">{item.title}</div>
                  <div className="text-[11px] text-gray-500 font-mono mt-0.5">{item.date} • {item.reason}</div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
            <div className="flex flex-col items-center justify-center text-center space-y-4">
              <div className="w-20 h-20 rounded-full border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
                <Clock className="w-10 h-10" />
              </div>
              <div className="text-xs text-gray-500">
                Scegli un elemento dall&apos;elenco o{' '}
                <button
                  onClick={() => {
                    const date = prompt('Inserisci data di chiusura:', '2026-08-16');
                    if (date) {
                      setExtraClosures((prev) => [
                        ...prev,
                        { id: String(Date.now()), date, title: 'Chiusura Straordinaria', reason: 'Ferie' },
                      ]);
                    }
                  }}
                  className="text-tw-blue font-medium hover:underline cursor-pointer"
                >
                  aggiungine uno nuovo
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
