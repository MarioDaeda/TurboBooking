'use client';

import React, { useState, useEffect } from 'react';
import { X, Check, Clock, Sun, Moon, AlertTriangle, RotateCcw } from 'lucide-react';
import { AgendaDay } from '@/lib/agendaDays';

interface DayScheduleModalProps {
  isOpen: boolean;
  onClose: () => void;
  day: AgendaDay | null;
  onSave: (params: {
    dayKey: string;
    dayName: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    applyToAllMatchingDays: boolean;
  }) => void;
  onResetOverride?: (dayKey: string) => void;
}

const TIME_OPTIONS = [
  '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
  '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
  '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
  '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
];

export const DayScheduleModal: React.FC<DayScheduleModalProps> = ({
  isOpen,
  onClose,
  day,
  onSave,
  onResetOverride,
}) => {
  const [isOpenDay, setIsOpenDay] = useState(true);
  const [openTime, setOpenTime] = useState('07:00');
  const [closeTime, setCloseTime] = useState('20:00');
  const [applyToAllMatchingDays, setApplyToAllMatchingDays] = useState(false);

  useEffect(() => {
    if (day) {
      setIsOpenDay(!day.isClosed);
      setOpenTime(day.openTime || '07:00');
      setCloseTime(day.closeTime || '20:00');
      setApplyToAllMatchingDays(false);
    }
  }, [day, isOpen]);

  if (!isOpen || !day) return null;

  const fullDayNames: { [key: string]: string } = {
    LUN: 'Lunedì',
    MAR: 'Martedì',
    MER: 'Mercoledì',
    GIO: 'Giovedì',
    VEN: 'Venerdì',
    SAB: 'Sabato',
    DOM: 'Domenica',
  };

  const fullDayName = fullDayNames[day.name] || day.name;

  const handleApplyPreset = (open: string, close: string) => {
    setIsOpenDay(true);
    setOpenTime(open);
    setCloseTime(close);
  };

  const handleSave = () => {
    onSave({
      dayKey: day.key,
      dayName: day.name,
      isOpen: isOpenDay,
      openTime,
      closeTime,
      applyToAllMatchingDays,
    });
    onClose();
  };

  const handleReset = () => {
    if (onResetOverride) {
      onResetOverride(day.key);
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/40 backdrop-blur-[2px]">
      {/* Su mobile si apre come pannello dal basso */}
      <div className="relative w-full max-w-lg bg-white rounded-t-3xl sm:rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[92dvh] animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-tw-blue rounded-xl text-xs font-bold uppercase tracking-wide">
              <Clock className="w-4 h-4" />
              <span>{day.key}</span>
            </div>
            <div>
              <h2 className="text-sm font-bold text-gray-800">
                Orari e Disponibilità
              </h2>
              <p className="text-[11px] text-gray-500">
                {fullDayName} {day.date} Settembre 2026
              </p>
            </div>
          </div>

          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition"
            title="Chiudi"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="p-5 sm:p-6 space-y-5 overflow-y-auto flex-1 min-h-0">
          {/* Status Switcher: Aperto vs Chiuso */}
          <div className="space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              Stato del Salone per {fullDayName} {day.date}
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setIsOpenDay(true)}
                className={`py-3 px-4 rounded-2xl border-2 flex items-center justify-center gap-2.5 transition font-bold text-sm cursor-pointer ${
                  isOpenDay
                    ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-xs'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${isOpenDay ? 'bg-emerald-500' : 'bg-gray-300'}`} />
                <span>APERTO</span>
              </button>

              <button
                type="button"
                onClick={() => setIsOpenDay(false)}
                className={`py-3 px-4 rounded-2xl border-2 flex items-center justify-center gap-2.5 transition font-bold text-sm cursor-pointer ${
                  !isOpenDay
                    ? 'border-rose-500 bg-rose-50/50 text-rose-700 shadow-xs'
                    : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50'
                }`}
              >
                <div className={`w-3 h-3 rounded-full ${!isOpenDay ? 'bg-rose-500' : 'bg-gray-300'}`} />
                <span>CHIUSO</span>
              </button>
            </div>
          </div>

          {/* If Aperto: Opening & Closing Hours */}
          {isOpenDay ? (
            <div className="space-y-4 border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                    <Sun className="w-3.5 h-3.5 text-amber-500" />
                    Orario Apertura
                  </label>
                  <select
                    value={openTime}
                    onChange={(e) => setOpenTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs cursor-pointer"
                  >
                    {TIME_OPTIONS.filter((t) => t < closeTime).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                    <Moon className="w-3.5 h-3.5 text-indigo-500" />
                    Orario Chiusura
                  </label>
                  <select
                    value={closeTime}
                    onChange={(e) => setCloseTime(e.target.value)}
                    className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs cursor-pointer"
                  >
                    {TIME_OPTIONS.filter((t) => t > openTime).map((t) => (
                      <option key={t} value={t}>
                        {t}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {/* Quick Presets */}
              <div className="space-y-1.5 pt-1">
                <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                  Scorciatoie Orari
                </span>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('07:00', '20:00')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                  >
                    07:00 - 20:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('08:00', '19:00')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                  >
                    08:00 - 19:00
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('08:00', '13:00')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                  >
                    Solo Mattina (08-13)
                  </button>
                  <button
                    type="button"
                    onClick={() => handleApplyPreset('14:00', '20:00')}
                    className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                  >
                    Pomeriggio (14-20)
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
              <AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
              <div>
                <strong className="block font-bold">Giorno di chiusura straordinaria</strong>
                <span>
                  L&apos;agenda mostrerà l&apos;intera colonna di {fullDayName} {day.date} tratteggiata (grigia) e non sarà possibile inserire nuovi appuntamenti in questo giorno.
                </span>
              </div>
            </div>
          )}

          {/* Scope Selector: Solo questo giorno vs Tutti i [Giorno] */}
          <div className="border-t border-gray-100 pt-4 space-y-2">
            <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
              Ambito di applicazione
            </label>
            <div className="space-y-2">
              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                <input
                  type="radio"
                  name="scheduleScope"
                  checked={!applyToAllMatchingDays}
                  onChange={() => setApplyToAllMatchingDays(false)}
                  className="w-4 h-4 text-tw-blue focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-gray-800 block">
                    Modifica forzata solo per {day.key} ({day.date} Settembre)
                  </span>
                  <span className="text-gray-500">
                    Apertura o chiusura straordinaria limitata a questa data specifica.
                  </span>
                </div>
              </label>

              <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                <input
                  type="radio"
                  name="scheduleScope"
                  checked={applyToAllMatchingDays}
                  onChange={() => setApplyToAllMatchingDays(true)}
                  className="w-4 h-4 text-tw-blue focus:ring-0"
                />
                <div className="text-xs">
                  <span className="font-bold text-gray-800 block">
                    Aggiorna l&apos;orario standard di tutti i {fullDayName}
                  </span>
                  <span className="text-gray-500">
                    Modifica permanente nella tabella orari generali del salone.
                  </span>
                </div>
              </label>
            </div>
          </div>
        </div>

        {/* Footer Actions */}
        <div className="px-4 sm:px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex flex-wrap items-center justify-between gap-2">
          <div>
            {day.isOverridden && onResetOverride && (
              <button
                type="button"
                onClick={handleReset}
                className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 flex items-center gap-1.5 transition cursor-pointer"
                title="Ripristina l'orario ordinario per questo giorno"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>Ripristina Standard</span>
              </button>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/70 rounded-xl transition cursor-pointer"
            >
              Annulla
            </button>
            <button
              type="button"
              onClick={handleSave}
              className="px-5 py-2 text-xs font-bold bg-tw-blue hover:bg-tw-blue-hover text-white rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>Salva Orari Giorno</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
