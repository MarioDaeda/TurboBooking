'use client';

import React, { useState, useEffect } from 'react';
import { SectionId } from '@/types';
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Zap,
  ClipboardList,
  ShieldCheck,
  Menu,
  Scissors,
  Users,
  CreditCard,
  BookUser,
  Tag,
  Package,
  Megaphone,
  CircleDollarSign,
  Clock,
  Armchair,
  Truck,
  LineChart,
  Star,
  UserCircle,
  PlayCircle,
} from 'lucide-react';

interface TopHeaderProps {
  currentSection: SectionId;
  onOpenDrawer: () => void;
  onOpenFlashPromo: () => void;
  onOpenDayOverview: () => void;
  selectedStaffFilter: string;
  onSelectStaffFilter: (staff: string) => void;
  viewMode: 'giornaliero' | 'settimanale';
  onToggleViewMode: () => void;
  onSelectViewMode?: (mode: 'giornaliero' | 'settimanale') => void;
  selectedDay?: string;
  onPrevDay?: () => void;
  onNextDay?: () => void;
  onSelectSection?: (section: SectionId) => void;
  weekRangeLabel?: string;
  monthLabel?: string;
}

export const TopHeader: React.FC<TopHeaderProps> = ({
  currentSection,
  onOpenDrawer,
  onOpenFlashPromo,
  onOpenDayOverview,
  selectedStaffFilter,
  onSelectStaffFilter,
  viewMode,
  onToggleViewMode,
  onSelectViewMode,
  selectedDay = 'MER 2',
  onPrevDay,
  onNextDay,
  onSelectSection,
  weekRangeLabel,
  monthLabel = 'SET',
}) => {
  const [timeStr, setTimeStr] = useState('01:24');

  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      const hours = String(now.getHours()).padStart(2, '0');
      const mins = String(now.getMinutes()).padStart(2, '0');
      setTimeStr(`${hours}:${mins}`);
    };
    updateTime();
    const interval = setInterval(updateTime, 10000);
    return () => clearInterval(interval);
  }, []);

  const getSectionTitle = () => {
    switch (currentSection) {
      case 'agenda':
        return null;
      case 'cassa':
        return { label: 'CASSA', icon: <CreditCard className="w-5 h-5 text-gray-700" /> };
      case 'rubrica':
        return { label: 'RUBRICA', icon: <BookUser className="w-5 h-5 text-gray-700" /> };
      case 'promozioni':
        return { label: 'PROMOZIONI', icon: <Tag className="w-5 h-5 text-gray-700" /> };
      case 'masterclass':
        return { label: 'MASTERCLASS', icon: <PlayCircle className="w-5 h-5 text-gray-700" /> };
      case 'magazzino-prodotti':
        return { label: 'PRODOTTI', icon: <Package className="w-5 h-5 text-gray-700" /> };
      case 'magazzino-ordini':
        return { label: 'ORDINI INVIATI', icon: <Package className="w-5 h-5 text-gray-700" /> };
      case 'magazzino-scadenzario':
        return { label: 'MAGAZZINO → SCADENZARIO', icon: <Package className="w-5 h-5 text-gray-700" /> };
      case 'comunicazioni':
        return { label: 'COMUNICAZIONI', icon: <Megaphone className="w-5 h-5 text-gray-700" /> };
      case 'staff':
        return { label: 'STAFF', icon: <Users className="w-5 h-5 text-gray-700" /> };
      case 'spese':
        return { label: 'SPESE', icon: <CircleDollarSign className="w-5 h-5 text-gray-700" /> };
      case 'orari':
        return { label: 'ORARI', icon: <Clock className="w-5 h-5 text-gray-700" /> };
      case 'orari-aperture':
        return { label: 'ORARI → APERTURE STRAORDINARIE', icon: <Clock className="w-5 h-5 text-gray-700" /> };
      case 'orari-chiusure':
        return { label: 'ORARI → CHIUSURE STRAORDINARIE', icon: <Clock className="w-5 h-5 text-gray-700" /> };
      case 'trattamenti':
        return { label: 'TRATTAMENTI', icon: <Scissors className="w-5 h-5 text-gray-700" /> };
      case 'postazioni':
        return { label: 'POSTAZIONI', icon: <Armchair className="w-5 h-5 text-gray-700" /> };
      case 'fornitori':
        return { label: 'FORNITORI', icon: <Truck className="w-5 h-5 text-gray-700" /> };
      case 'produttori':
        return { label: 'PRODUTTORI', icon: <Truck className="w-5 h-5 text-gray-700" /> };
      case 'spedizioni':
        return { label: 'SPEDIZIONI', icon: <Truck className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-andamento':
        return { label: 'ANALISI ANDAMENTO', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-azienda':
        return { label: 'REPORT AZIENDA', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-corrispettivi':
        return { label: 'REPORT AZIENDA → CORRISPETTIVI', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-collaboratori':
        return { label: 'REPORT COLLABORATORI', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-clienti':
        return { label: 'REPORT CLIENTI', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-magazzino':
        return { label: 'REPORT MAGAZZINO', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'statistiche-inventario':
        return { label: 'REPORT MAGAZZINO → INVENTARIO', icon: <LineChart className="w-5 h-5 text-gray-700" /> };
      case 'recensioni':
        return { label: 'RECENSIONI', icon: <Star className="w-5 h-5 text-gray-700" /> };
      case 'profilo':
      case 'profilo-fatturazione':
      case 'profilo-impostazioni':
      case 'profilo-vetrina':
      case 'profilo-utenti':
        return { label: 'PROFILO', icon: <UserCircle className="w-5 h-5 text-gray-700" /> };
      default:
        return { label: 'TURBOBOOKING', icon: <Calendar className="w-5 h-5 text-gray-700" /> };
    }
  };

  const sectionMeta = getSectionTitle();

  return (
    <header className="h-14 bg-white border-b border-tw-border flex items-center justify-between px-4 select-none z-20">
      {/* Left Area: Navigation or Title */}
      <div className="flex items-center gap-3">
        {currentSection === 'agenda' ? (
          <div className="flex items-center gap-2">
            <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 transition">
              <Calendar className="w-5 h-5 text-gray-700" />
            </button>
            <span className="font-semibold text-xs text-gray-700 uppercase tracking-wide">{monthLabel}</span>
            <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5 text-xs text-tw-blue font-semibold">
              {viewMode === 'settimanale' ? (
                <span>{weekRangeLabel || 'LUN 07 → DOM 13'}</span>
              ) : (
                <span>{selectedDay}</span>
              )}
            </div>
            <div className="flex items-center gap-0.5 text-gray-500">
              <button
                onClick={onPrevDay}
                className="p-1 hover:bg-gray-100 rounded transition cursor-pointer"
                title={viewMode === 'giornaliero' ? 'Giorno precedente' : 'Settimana precedente'}
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button
                onClick={onNextDay}
                className="p-1 hover:bg-gray-100 rounded transition cursor-pointer"
                title={viewMode === 'giornaliero' ? 'Giorno successivo' : 'Settimana successiva'}
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        ) : currentSection === 'orari-aperture' || currentSection === 'orari-chiusure' ? (
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-gray-700" />
            <button
              onClick={() => onSelectSection?.('orari')}
              className="font-bold text-xs uppercase tracking-wider text-tw-blue hover:underline cursor-pointer"
              title="Torna a Orari Salone"
            >
              ORARI
            </button>
            <span className="text-gray-400 text-xs font-bold">→</span>
            <h1 className="font-bold text-xs uppercase tracking-wider text-tw-text-main">
              {currentSection === 'orari-aperture' ? 'APERTURE STRAORDINARIE' : 'CHIUSURE STRAORDINARIE'}
            </h1>
          </div>
        ) : (
          <div className="flex items-center gap-2.5">
            {sectionMeta?.icon}
            <h1 className="font-bold text-xs uppercase tracking-wider text-tw-text-main">
              {sectionMeta?.label}
            </h1>
          </div>
        )}
      </div>

      {/* Center Area: Digital Clock */}
      <div className="font-mono text-base font-semibold text-gray-500 tracking-tight">
        {timeStr}
      </div>

      {/* Right Area: Filters & Action Buttons */}
      <div className="flex items-center gap-3">
        {currentSection === 'agenda' && (
          <>
            {/* View Switcher Dropdown */}
            <div className="relative">
              <select
                value={viewMode}
                onChange={(e) => {
                  const mode = e.target.value as 'giornaliero' | 'settimanale';
                  if (onSelectViewMode) {
                    onSelectViewMode(mode);
                  } else if (mode !== viewMode) {
                    onToggleViewMode();
                  }
                }}
                className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-tw-blue cursor-pointer"
              >
                <option value="settimanale">Settimanale</option>
                <option value="giornaliero">Giornaliero</option>
              </select>
              <span className="absolute right-2 top-2 pointer-events-none text-[10px] text-gray-400">
                ⌄
              </span>
            </div>

            {/* Staff Filter Dropdown */}
            <div className="relative">
              <select
                value={selectedStaffFilter}
                onChange={(e) => onSelectStaffFilter(e.target.value)}
                className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-tw-blue cursor-pointer"
              >
                <option value="all">Tutti i collaboratori</option>
                <option value="staff-1">Gianluca</option>
                <option value="staff-2">Sara</option>
              </select>
              <span className="absolute right-2 top-2 pointer-events-none text-[10px] text-gray-400">
                ⌄
              </span>
            </div>
          </>
        )}

        {/* Quick Actions Buttons */}
        <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
          {/* Flash Promo Button (Saetta) */}
          <button
            onClick={onOpenFlashPromo}
            title="Promo Flash"
            className="p-2 hover:bg-blue-50 text-gray-600 hover:text-tw-blue rounded-md transition"
          >
            <Zap className="w-4 h-4" />
          </button>

          {/* Day Overview / Ricevute Button */}
          <button
            onClick={onOpenDayOverview}
            title="Panoramica del Giorno"
            className="p-2 hover:bg-blue-50 text-gray-600 hover:text-tw-blue rounded-md transition"
          >
            <ClipboardList className="w-4 h-4" />
          </button>

          {/* Security / Compliance Shield */}
          <button
            title="Conforme GDPR & Normativa Fiscale"
            className="p-2 hover:bg-gray-100 text-gray-500 rounded-md transition"
          >
            <ShieldCheck className="w-4 h-4" />
          </button>

          {/* Hamburger Menu Icon */}
          <button
            onClick={onOpenDrawer}
            title="Apri Menu Principale"
            className="p-2 hover:bg-gray-100 text-gray-700 hover:text-tw-blue rounded-md transition ml-1"
          >
            <Menu className="w-5 h-5" />
          </button>
        </div>
      </div>
    </header>
  );
};
