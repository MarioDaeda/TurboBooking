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
  Armchair,
  Search,
  ChevronDown,
  Calendar,
  Scissors,
  AlertCircle,
} from 'lucide-react';
import { Appointment, ServiceItem, StaffMember, Client } from '@/types';
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
  clients?: Client[];
  onSave: (app: Appointment) => Promise<void> | void;
  onDelete: (appId: string) => Promise<void> | void;
  onSendToCassa: (app: Appointment) => void;
}

export const AppointmentModal: React.FC<AppointmentModalProps> = ({
  isOpen,
  onClose,
  appointment,
  services,
  staffList,
  clients,
  onSave,
  onDelete,
  onSendToCassa,
}) => {
  const [clientName, setClientName] = useState('');
  const [clientPhone, setClientPhone] = useState('');
  const [clientEmail, setClientEmail] = useState('');
  const [clientId, setClientId] = useState('');
  const [hasPrivacyConsent, setHasPrivacyConsent] = useState(false);
  const [serviceId, setServiceId] = useState('');
  const [staffId, setStaffId] = useState('');
  const [durationMinutes, setDurationMinutes] = useState(45);
  const [notes, setNotes] = useState('');
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [showClientSuggestions, setShowClientSuggestions] = useState(false);

  // Search & Filter state for treatment dropdown
  const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
  const [serviceSearchQuery, setServiceSearchQuery] = useState('');
  const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TUTTI');

  const dropdownRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Default service is the first available service from Supabase
  const defaultService = useMemo(() => {
    return (
      services.find((s) => s.name.toLowerCase().includes('taglio uomo top stylist')) ||
      services.find((s) => s.name.toLowerCase().includes('taglio')) ||
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
      setClientId(appointment.clientId || '');
      setClientName(appointment.clientName || '');
      setClientPhone(appointment.clientPhone || '');
      setClientEmail(appointment.clientEmail || '');
      setHasPrivacyConsent(appointment.hasPrivacyConsent);
      setServiceId(appointment.serviceId);
      setStaffId(appointment.staffId);
      setDurationMinutes(appointment.durationMinutes);
      setNotes(appointment.notes || '');
    } else {
      setClientId('');
      setClientName('');
      setClientPhone('');
      setClientEmail('');
      setHasPrivacyConsent(false);
      const def = defaultService;
      setServiceId(def?.id || services[0]?.id || '');
      setStaffId(staffList[0]?.id || '');
      setDurationMinutes(def?.durationMinutes || 45);
      setNotes('');
    }
    setIsServiceDropdownOpen(false);
    setServiceSearchQuery('');
    setSelectedCategoryFilter('TUTTI');
    setErrorMessage(null);
  }, [appointment, services, staffList, defaultService]);

  if (!isOpen) return null;

  const currentService = services.find((s) => s.id === serviceId) || defaultService;
  const currentStaff = staffList.find((st) => st.id === staffId) || staffList[0];

  const buildAppointmentObject = (resolvedClientId?: string): Appointment => {
    const existingId = appointment?.id;
    const finalClientId =
      resolvedClientId ||
      clientId ||
      appointment?.clientId ||
      '';

    return {
      id: existingId || `app-${Date.now()}`,
      clientId: finalClientId,
      clientName: clientName.trim() || 'Nuovo Cliente',
      clientPhone: clientPhone.trim(),
      clientEmail: clientEmail.trim(),
      hasPrivacyConsent,
      serviceId: currentService?.id || defaultService?.id || services[0]?.id || '',
      serviceName: currentService?.name || defaultService?.name || 'Trattamento',
      serviceShortname: currentService?.shortname || defaultService?.shortname || 'TR',
      serviceColor: currentService?.categoryColor || defaultService?.categoryColor || '#3B82F6',
      staffId: currentStaff?.id || staffList[0]?.id || '',
      staffInitials: currentStaff?.initials || staffList[0]?.initials || 'OP',
      staffName: currentStaff?.name || staffList[0]?.name || 'Operatore',
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

  const handleSave = async () => {
    setIsSaving(true);
    setErrorMessage(null);

    try {
      let resolvedId = clientId;
      if (appointment && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(appointment.id)
          && resolvedId !== appointment.clientId) {
        throw new Error('Il cliente di un appuntamento esistente non può essere sostituito da questa finestra.');
      }

      // Se il cliente non ha ancora un ID UUID valido:
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(resolvedId)) {
        const existing = clients?.some(
          (c) =>
            (clientPhone && c.phone && c.phone.trim() === clientPhone.trim()) ||
            (clientName && c.name.toLowerCase() === clientName.toLowerCase().trim())
        );

        if (existing) {
          throw new Error('Esistono clienti con questo nome o telefono. Seleziona esplicitamente il cliente dai suggerimenti.');
        } else if (clientName.trim()) {
          const parts = clientName.trim().split(' ');
          const firstName = parts[0] || 'Cliente';
          const lastName = parts.slice(1).join(' ') || null;

          const res = await fetch('/api/v1/customers', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              firstName,
              lastName,
              phone: clientPhone.trim() || undefined,
              email: clientEmail.trim() || undefined,
              notes: notes.trim() || undefined,
              privacyConsent: hasPrivacyConsent,
            }),
          });
          const data = await res.json();
          if (!res.ok || !data.success) {
            throw new Error(data.error || 'Errore durante la creazione del cliente.');
          }
          resolvedId = data.customer.id;
          setClientId(resolvedId);
        }
      }

      if (!resolvedId) {
        throw new Error('Inserisci il nome del cliente prima di salvare.');
      }

      const updated = buildAppointmentObject(resolvedId);
      await onSave(updated);
      onClose();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore durante il salvataggio.';
      setErrorMessage(msg);
    } finally {
      setIsSaving(false);
    }
  };

  const handleSelectService = (srv: ServiceItem) => {
    setServiceId(srv.id);
    if (srv.durationMinutes) {
      setDurationMinutes(srv.durationMinutes);
    }
    setIsServiceDropdownOpen(false);
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

        {/* Error Banner if any */}
        {errorMessage && (
          <div className="mx-6 sm:mx-8 mt-4 p-3.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl flex items-center gap-2">
            <AlertCircle className="w-4 h-4 flex-shrink-0" />
            <span className="font-semibold">{errorMessage}</span>
          </div>
        )}

        {/* Modal Form Body */}
        <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
          {/* Client Details Card */}
          <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100 space-y-4">
            <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
              <span>DATI CLIENTE</span>
              <span className="text-xs text-gray-400 font-normal">Scheda anagrafica rapida</span>
            </div>

            {/* Client Name with Info & History Icons */}
            <div className="relative">
              <div className="relative flex items-center">
                <input
                  type="text"
                  value={clientName}
                  onFocus={() => setShowClientSuggestions(true)}
                  onChange={(e) => {
                    setClientName(e.target.value);
                    setClientId('');
                    setHasPrivacyConsent(false);
                    setShowClientSuggestions(true);
                  }}
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

              {/* Client Suggestions Dropdown */}
              {showClientSuggestions && clients && clients.length > 0 && clientName.trim().length >= 1 && (
                <div className="absolute top-full left-0 right-0 z-30 mt-1 bg-white border border-gray-200 rounded-xl shadow-lg max-h-48 overflow-y-auto divide-y divide-gray-100">
                  {clients
                    .filter((c) =>
                      c.name.toLowerCase().includes(clientName.toLowerCase()) ||
                      (c.phone && c.phone.includes(clientName))
                    )
                    .slice(0, 5)
                    .map((c) => (
                      <div
                        key={c.id}
                        onMouseDown={() => {
                          setClientId(c.id);
                          setClientName(c.name);
                          setClientPhone(c.phone || '');
                          setClientEmail(c.email || '');
                          setHasPrivacyConsent(c.hasPrivacyConsent);
                          setShowClientSuggestions(false);
                        }}
                        className="p-2.5 hover:bg-blue-50 cursor-pointer text-xs flex items-center justify-between"
                      >
                        <div>
                          <div className="font-bold text-gray-800">{c.name}</div>
                          <div className="text-[11px] text-gray-500">{c.phone || 'Nessun telefono'}</div>
                        </div>
                        <span className="text-[10px] text-tw-blue font-mono bg-blue-50 px-1.5 py-0.5 rounded">
                          Seleziona
                        </span>
                      </div>
                    ))}
                </div>
              )}
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
                onClick={() => window.print()}
                className="p-2.5 hover:bg-gray-100 text-gray-500 rounded-xl border border-gray-200 transition"
                title="Stampa promemoria o scheda lavoro"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Prominent Save / Confirm Buttons in Footer */}
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  const updated = buildAppointmentObject();
                  onSave(updated);
                  onSendToCassa(updated);
                  onClose();
                }}
                className="px-4 py-2.5 rounded-xl bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold flex items-center gap-1.5 shadow-sm transition"
                title="Salva e invia a cassa"
              >
                <span>Alla Cassa</span>
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="px-6 py-2.5 rounded-xl bg-tw-blue hover:bg-tw-blue-hover text-white text-sm font-bold flex items-center gap-2 shadow-sm transition disabled:opacity-50"
                title="Salva e conferma appuntamento"
              >
                <Check className="w-4 h-4" />
                <span>{isSaving ? 'Salvataggio...' : 'Salva Appuntamento'}</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
