'use client';

import React, { useState, useEffect, useRef, useMemo } from 'react';
import {
  X,
  Check,
  Info,
  ListFilter,
  Heart,
  Smile,
  Clock,
  Cake,
  FileText,
  Trash2,
  Printer,
  ArrowRight,
  Armchair,
  Search,
  ChevronDown,
  Calendar,
  CheckCircle2,
  Scissors,
} from 'lucide-react';
import { Appointment, ServiceItem, StaffMember } from '@/types';
import { getTodayDayKey, getTodayIsoDate } from '@/lib/agendaDays';

const formatDurationHours = (minutes: number): string =>
  `${Math.floor(minutes / 60)}.${(minutes % 60).toString().padStart(2, '0')}h`;

const DURATION_STEPS = Array.from({ length: 40 }, (_, i) => (i + 1) * 15);

interface AppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  appointment: Appointment | null;
  services: ServiceItem[];
  staffList: StaffMember[];
  onSave: (app: Appointment) => void;
  onDelete: (appId: string) => void;
  onSendToCassa: (app: Appointment) => void;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  services,
  staffList,
  onSave,
  onDelete,
  onSendToCassa,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [notes, setNotes] = useState('');

  // Search & Filter state for treatment dropdown
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TUTTI');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Default service is Taglio Uomo Top Stylist (srv-5)
  const defaultService = useMemo(() => {
    return (
      services.find((s) => s.id === 'srv-5') ||
      services.find((s) => s.name.toLowerCase().includes('taglio uomo top stylist')) ||
      services[0]
    );
  }, [services]);

  // Unique categories list
  const categories = useMemo(() => {
    const cats = Array.from(new Set(services.map((s) => s.category).filter(Boolean)));
    return ['TUTTI', ...cats];
  }, [services]);

  // Filtered services based on search query & category pill
  const filteredServices = useMemo(() => {
    const q = serviceSearchQuery.toLowerCase().trim();
    return services.filter((srv) => {
      const matchCat =
        selectedCategoryFilter === 'TUTTI' || srv.category === selectedCategoryFilter;
      const matchQuery =
        !q ||
        srv.name.toLowerCase().includes(q) ||
        srv.category.toLowerCase().includes(q) ||
        srv.shortname.toLowerCase().includes(q);
      return matchCat && matchQuery;
    });
  }, [services, serviceSearchQuery, selectedCategoryFilter]);

  // Close dropdown on outside click
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setIsServiceDropdownOpen(false);
      }
    };
    if (isServiceDropdownOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isServiceDropdownOpen]);

  // Focus search input when dropdown opens
  useEffect(() => {
    if (isServiceDropdownOpen && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isServiceDropdownOpen]);

  useEffect(() => {
    if (appointment) {
      setClientName(appointment.clientName);
      setClientPhone(appointment.clientPhone || '');
      setClientEmail(appointment.clientEmail || '');
      setHasPrivacyConsent(appointment.hasPrivacyConsent);
      setServiceId(appointment.serviceId);
      setStaffId(appointment.staffId);
      setDurationMinutes(appointment.durationMinutes);
      setNotes(appointment.notes || '');
    } else {
      setClientName('Morena');
      setClientPhone('+39 347 1234567');
      setClientEmail('');
      setHasPrivacyConsent(false);
      const def = defaultService;
      setServiceId(def?.id || '');
      setStaffId(staffList[0]?.id || '');
      setDurationMinutes(def?.durationMinutes || 45);
      setNotes('');
    }
    setIsServiceDropdownOpen(false);
    setServiceSearchQuery('');
    setSelectedCategoryFilter('TUTTI');
  }, [appointment, services, staffList, defaultService]);

  if (!isOpen) return null;

  const currentService = services.find((s) => s.id === serviceId) || defaultService;
  const currentStaff = staffList.find((st) => st.id === staffId) || staffList[0];

  const buildAppointmentObject = (): Appointment => {
    const existingId = appointment?.id;
    const existingClientId =
      appointment?.clientId && appointment.clientId !== 'cli-new' && appointment.clientId !== 'cli-temp'
        ? appointment.clientId
        : `cli-${Date.now()}`;

    return {
      id: existingId || `app-${Date.now()}`,
      clientId: existingClientId,
      clientName: clientName.trim() || 'Nuovo Cliente',
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      hasPrivacyConsent,
      serviceId: currentService?.id || defaultService?.id || 'srv-5',
      serviceName: currentService?.name || defaultService?.name || 'Taglio Uomo Top Stylist',
      serviceShortname: currentService?.shortname || defaultService?.shortname || 'TU',
      serviceColor: currentService?.categoryColor || defaultService?.categoryColor || '#8B5CF6',
      staffId: currentStaff?.id || 'staff-1',
      staffInitials: currentStaff?.initials || 'GI',
      staffName: currentStaff?.name || 'Gianluca',
      date: appointment ? appointment.date : getTodayIsoDate(),
      dayOfWeek: appointment ? appointment.dayOfWeek : getTodayDayKey(),
      startTime: appointment ? appointment.startTime : '08:00',
      durationFormatted: formatDurationHours(durationMinutes),
      durationMinutes,
      cleaningMinutes: 0,
      notes,
      feePercentage: 0,
      source: appointment ? appointment.source : 'DIRECT',
      status: 'confirmed',
    };
  };

  const handleSave = () => {
    const updated = buildAppointmentObject();
    onSave(updated);
    onClose();
  };

  const handleSendToCassaClick = () => {
    const updated = buildAppointmentObject();
    onSave(updated);
    onSendToCassa(updated);
    onClose();
  };

  const handleSelectService = (srv: ServiceItem) => {
    setServiceId(srv.id);
    if (srv.durationMinutes) {
      setDurationMinutes(srv.durationMinutes);
    }
    setIsServiceDropdownOpen(false);
    setServiceSearchQuery('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[2px] overflow-y-auto">
      <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150 my-auto flex flex-col max-h-[94vh]">
        {/* Top Title Bar */}
        <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-tw-blue rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide">
              <Calendar className="w-4 h-4" />
              {appointment
                ? `${appointment.dayOfWeek} - ${appointment.startTime}`
                : `${getTodayDayKey()} - 08:00`}
            </div>
            <span className="text-xs sm:text-sm font-bold text-gray-700 hidden sm:inline">
              {appointment ? 'Dettagli Appuntamento' : 'Nuovo Appuntamento'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition"
            title="Chiudi finestra"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Privacy Alert Pill / Consent Toggle */}
          <div className="flex justify-center">
            {hasPrivacyConsent ? (
              <button
                type="button"
                onClick={() => setHasPrivacyConsent(false)}
                className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-semibold px-4 py-1.5 rounded-full flex items-center gap-2 hover:bg-emerald-100 transition shadow-xs"
              >
                <CheckCircle2 className="w-4 h-4 text-emerald-600" />
                Consenso privacy attivo (clicca per disattivare)
              </button>
            ) : (
              <button
                type="button"
                onClick={() => setHasPrivacyConsent(true)}
                className="bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-1.5 rounded-full shadow-xs transition"
                title="Clicca per accordare il consenso"
              >
                Non ha dato i consensi per la privacy (clicca per attivare)
              </button>
            )}
          </div>

          {/* Client Details Card */}
          <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100 space-y-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>DATI CLIENTE</span>
              <span className="text-xs text-gray-400 font-normal">Scheda anagrafica rapida</span>
            </div>

            {/* Client Name with Info & History Icons */}
            <div className="relative flex items-center">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome e cognome cliente..."
                className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue pr-24 shadow-xs"
              />
              <div className="absolute right-3.5 flex items-center gap-2 text-gray-400">
                <button
                  type="button"
                  onClick={() => alert(`Dettagli cliente: ${clientName || 'Nuovo'}`)}
                  className="hover:text-tw-blue p-1.5 rounded-lg hover:bg-blue-50 transition"
                  title="Scheda cliente"
                >
                  <Info className="w-4 h-4 text-tw-blue" />
                </button>
                <button
                  type="button"
                  onClick={() => alert(`Storico appuntamenti di: ${clientName || 'Cliente'}`)}
                  className="relative hover:text-tw-blue p-1.5 rounded-lg hover:bg-blue-50 transition"
                  title="Storico visite"
                >
                  <ListFilter className="w-4 h-4" />
                  <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                    1
                  </span>
                </button>
              </div>
            </div>

            {/* Phone & Email in a 2-Column Responsive Grid */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                  Telefono
                </label>
                <input
                  type="text"
                  value={clientPhone}
                  onChange={(e) => setClientPhone(e.target.value)}
                  placeholder="+39 347 0000000"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <label className="block text-xs font-bold uppercase text-gray-500">
                    Email
                  </label>
                  <span className="text-[10px] font-bold text-emerald-600 tracking-wider">
                    PER RECENSIONI
                  </span>
                </div>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  placeholder="cliente@email.it"
                  className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs"
                />
              </div>
            </div>

            {/* Quick reaction icons row */}
            <div className="flex items-center justify-center gap-8 pt-1 text-gray-400 border-t border-gray-200/60">
              <button
                type="button"
                className="hover:text-red-500 transition p-1.5 hover:scale-110"
                title="Cliente preferito"
              >
                <Heart className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-amber-500 transition p-1.5 hover:scale-110"
                title="Livello soddisfazione"
              >
                <Smile className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-blue-500 transition p-1.5 hover:scale-110"
                title="Puntualità cliente"
              >
                <Clock className="w-5 h-5" />
              </button>
              <span className="text-gray-300">•</span>
              <button
                type="button"
                className="hover:text-pink-500 transition p-1.5 hover:scale-110"
                title="Compleanno cliente"
              >
                <Cake className="w-5 h-5" />
              </button>
              <button
                type="button"
                className="hover:text-indigo-500 transition p-1.5 hover:scale-110"
                title="Note tecniche salvate"
              >
                <FileText className="w-5 h-5" />
              </button>
            </div>
          </div>

          {/* Service & Booking Details Card */}
          <div className="border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-5 bg-white shadow-xs">
            <div className="flex items-center justify-between pb-2 border-b border-gray-100">
              <div className="flex items-center gap-2.5">
                <span className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                  <Scissors className="w-4 h-4 text-tw-blue" />
                  Trattamento Selezionato
                </span>
                <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-lg font-mono font-semibold">
                  {services.length} trattamenti disponibili
                </span>
              </div>
              <div className="text-sm font-mono font-bold text-tw-blue bg-blue-50 px-3 py-1 rounded-full">
                {appointment?.startTime || '08:00'} ({formatDurationHours(durationMinutes)})
              </div>
            </div>

            {/* Custom Searchable Dropdown for Services */}
            <div className="relative" ref={dropdownRef}>
              <div className="flex items-center justify-between mb-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Trattamento Principale
                </label>
                <span className="text-xs text-tw-blue font-semibold">
                  Clicca per cercare o cambiare trattamento
                </span>
              </div>

              {/* Dropdown trigger card - Prominent, large, readable */}
              <button
                type="button"
                onClick={() => setIsServiceDropdownOpen((prev) => !prev)}
                className={`w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl border text-left transition shadow-xs ${
                  isServiceDropdownOpen
                    ? 'border-tw-blue ring-4 ring-tw-blue/15 bg-blue-50/20'
                    : 'border-gray-200 hover:border-tw-blue/80 hover:bg-gray-50/50 bg-white'
                }`}
              >
                <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
                  <span
                    className="w-12 h-12 rounded-2xl text-sm font-black text-white flex items-center justify-center shrink-0 shadow-sm uppercase tracking-wide"
                    style={{ backgroundColor: currentService?.categoryColor || '#8B5CF6' }}
                  >
                    {currentService?.shortname || 'TU'}
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2.5 flex-wrap">
                      <span className="font-extrabold text-base sm:text-lg text-gray-900 truncate">
                        {currentService?.name || 'Seleziona trattamento'}
                      </span>
                      <span
                        className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide"
                        style={{
                          backgroundColor: `${currentService?.categoryColor}18`,
                          color: currentService?.categoryColor,
                        }}
                      >
                        {currentService?.category || 'TAGLIO'}
                      </span>
                    </div>
                    <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-3 pt-1">
                      <span>
                        Durata standard: <strong>{currentService?.duration || '00:45'}</strong> ({durationMinutes}m)
                      </span>
                      <span>•</span>
                      <span className="font-bold text-gray-900 text-sm sm:text-base">
                        €{currentService ? currentService.price.toFixed(2) : '30.00'}
                      </span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2.5 text-gray-400 shrink-0">
                  <span className="text-xs sm:text-sm font-semibold text-gray-500 hidden sm:inline">
                    Cambia
                  </span>
                  <ChevronDown
                    className={`w-5 h-5 transition-transform duration-200 ${
                      isServiceDropdownOpen ? 'rotate-180 text-tw-blue' : ''
                    }`}
                  />
                </div>
              </button>

              {/* Dropdown Overlay Menu */}
              {isServiceDropdownOpen && (
                <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                  {/* Search bar inside dropdown */}
                  <div className="p-3.5 border-b border-gray-100 bg-gray-50/80">
                    <div className="relative flex items-center">
                      <Search className="w-5 h-5 text-gray-400 absolute left-3.5" />
                      <input
                        ref={searchInputRef}
                        type="text"
                        value={serviceSearchQuery}
                        onChange={(e) => setServiceSearchQuery(e.target.value)}
                        placeholder="Cerca trattamento (es. Taglio, Barba, Colore, Piega)..."
                        className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-10 py-2.5 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue"
                      />
                      {serviceSearchQuery && (
                        <button
                          type="button"
                          onClick={() => setServiceSearchQuery('')}
                          className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-md"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      )}
                    </div>

                    {/* Quick Category Filter Pills */}
                    <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar">
                      {categories.map((cat) => (
                        <button
                          key={cat}
                          type="button"
                          onClick={() => setSelectedCategoryFilter(cat)}
                          className={`text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 transition ${
                            selectedCategoryFilter === cat
                              ? 'bg-tw-blue text-white shadow-xs'
                              : 'bg-white text-gray-700 hover:bg-gray-200/70 border border-gray-200/80'
                          }`}
                        >
                          {cat}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Filtered Services List */}
                  <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                    {filteredServices.length === 0 ? (
                      <div className="p-8 text-center text-sm text-gray-500">
                        Nessun trattamento trovato per &ldquo;{serviceSearchQuery}&rdquo;
                        <button
                          type="button"
                          onClick={() => {
                            setServiceSearchQuery('');
                            setSelectedCategoryFilter('TUTTI');
                          }}
                          className="block mx-auto mt-2 text-tw-blue hover:underline font-bold"
                        >
                          Mostra tutti i 40 trattamenti
                        </button>
                      </div>
                    ) : (
                      filteredServices.map((srv) => {
                        const isSelected = srv.id === serviceId;
                        return (
                          <div
                            key={srv.id}
                            onClick={() => handleSelectService(srv)}
                            className={`p-4 flex items-center justify-between cursor-pointer transition ${
                              isSelected
                                ? 'bg-blue-50/80 border-l-4 border-tw-blue'
                                : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center gap-3.5 min-w-0 mr-3">
                              <span
                                className="w-10 h-10 rounded-xl text-xs font-black text-white flex items-center justify-center shrink-0 uppercase shadow-xs tracking-wide"
                                style={{ backgroundColor: srv.categoryColor }}
                              >
                                {srv.shortname}
                              </span>
                              <div className="min-w-0">
                                <div className="text-sm sm:text-base font-bold text-gray-900 truncate">
                                  {srv.name}
                                </div>
                                <div className="flex items-center gap-2.5 text-xs text-gray-500 pt-0.5">
                                  <span
                                    className="font-bold uppercase tracking-wider"
                                    style={{ color: srv.categoryColor }}
                                  >
                                    {srv.category}
                                  </span>
                                  <span>•</span>
                                  <span>{srv.duration} ({srv.durationMinutes} min)</span>
                                </div>
                              </div>
                            </div>

                            <div className="flex items-center gap-3 shrink-0">
                              <span className="text-sm sm:text-base font-extrabold text-gray-900 bg-gray-100 px-3 py-1 rounded-xl">
                                €{srv.price.toFixed(2)}
                              </span>
                              {isSelected && (
                                <Check className="w-5 h-5 text-tw-blue shrink-0" />
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* 2-Column Row for Duration & Staff */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
              {/* Duration Field */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Durata Appuntamento
                </label>
                <div className="relative">
                  <select
                    value={durationMinutes}
                    onChange={(e) => setDurationMinutes(Number(e.target.value))}
                    className="w-full text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer appearance-none shadow-xs pr-9"
                  >
                    {(DURATION_STEPS.includes(durationMinutes)
                      ? DURATION_STEPS
                      : [...DURATION_STEPS, durationMinutes].sort((a, b) => a - b)
                    ).map((min) => (
                      <option key={min} value={min}>
                        {formatDurationHours(min)} ({min} min)
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>

              {/* Staff Member (CON) */}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                  Collaboratore (CON)
                </label>
                <div className="relative">
                  <select
                    value={staffId}
                    onChange={(e) => setStaffId(e.target.value)}
                    className="w-full text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer appearance-none shadow-xs"
                  >
                    {staffList.map((st) => (
                      <option key={st.id} value={st.id}>
                        {st.name} ({st.role})
                      </option>
                    ))}
                  </select>
                  <Armchair className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                </div>
              </div>
            </div>

            {/* Note Tecniche */}
            <div className="space-y-1.5 pt-1">
              <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                Note Tecniche Appuntamento
              </label>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Inserisci qui le note tecniche, formule di colore, preferenze cliente..."
                rows={3}
                className="w-full text-sm p-3.5 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs resize-none"
              />
            </div>

            {/* Info Row: Fee, Source, Price Summary */}
            <div className="flex items-center justify-between text-xs text-gray-500 font-medium pt-3 border-t border-gray-100">
              <div className="flex items-center gap-3">
                <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-bold">FEE 0%</span>
                <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-bold">FONTE DIRECT</span>
              </div>
              <div className="text-right">
                <span className="text-gray-500 mr-1.5 text-xs">Importo stimato:</span>
                <span className="font-extrabold text-gray-900 text-sm sm:text-base">
                  €{currentService ? currentService.price.toFixed(2) : '30.00'}
                </span>
              </div>
            </div>
          </div>

          {/* Bottom Action Buttons Bar (without Alla Cassa) */}
          <div className="flex items-center justify-between pt-3 border-t border-gray-100">
            <div className="flex items-center gap-2.5 flex-wrap">
              <button
                type="button"
                onClick={() => {
                  if (appointment && confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
                    onDelete(appointment.id);
                    onClose();
                  }
                }}
                className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl border border-gray-200 transition"
                title="Elimina appuntamento"
              >
                <Trash2 className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={() =>
                  alert(
                    '✂️ "Taglia": L\'appuntamento è stato memorizzato negli appunti. Clicca su un nuovo orario o data in agenda per incollarlo e spostarlo.'
                  )
                }
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition"
                title="Taglia e sposta in un altro orario"
              >
                Taglia
              </button>
              <button
                type="button"
                onClick={() =>
                  alert(
                    '🔁 "Ripeti": Configura la frequenza dell\'appuntamento ricorrente (es. ogni 1, 2 o 4 settimane per clienti abituali).'
                  )
                }
                className="px-3.5 py-2 text-xs sm:text-sm font-semibold text-gray-700 hover:bg-gray-100 rounded-xl border border-gray-200 transition"
                title="Imposta appuntamento ricorrente"
              >
                Ripeti
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2.5 hover:bg-gray-100 text-gray-500 rounded-xl border border-gray-200 transition"
                title="Stampa promemoria o scheda lavoro"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent Save / Confirm Button in Footer */}
            <button
              type="button"
              onClick={handleSave}
              className="px-6 py-2.5 rounded-xl bg-tw-blue hover:bg-tw-blue-hover text-white text-sm font-bold flex items-center gap-2 shadow-sm transition"
              title="Salva e conferma appuntamento"
            >
              <Check className="w-4 h-4" />
              <span>Salva Appuntamento</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
