'use client';

import { StaffGate } from '@/components/auth/StaffGate';
import { romeLocalToUtc } from '@/lib/romeTime';
import { bookingSaveRequest } from '@/lib/bookingSaveRequest';
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { SectionId, Appointment, Client, ServiceItem, StaffMember, DaySchedule } from '@/types';
import { mockVenues } from '@/data/mockData';
import { VenueRail } from '@/components/layout/VenueRail';
import { TopHeader } from '@/components/layout/TopHeader';
import { MainDrawerMenu } from '@/components/layout/MainDrawerMenu';
import { DayOverviewModal } from '@/components/modals/DayOverviewModal';
import { FlashPromoModal } from '@/components/modals/FlashPromoModal';
import { AppointmentModal } from '@/components/modals/AppointmentModal';

import { AgendaView } from '@/components/modules/agenda/AgendaView';
import { CassaView } from '@/components/modules/cassa/CassaView';
import { RubricaView } from '@/components/modules/rubrica/RubricaView';
import { PromozioniView } from '@/components/modules/promozioni/PromozioniView';
import { MasterclassView } from '@/components/modules/masterclass/MasterclassView';
import { MagazzinoView } from '@/components/modules/magazzino/MagazzinoView';
import { ComunicazioniView } from '@/components/modules/comunicazioni/ComunicazioniView';
import { StaffView } from '@/components/modules/staff/StaffView';
import { SpeseView } from '@/components/modules/spese/SpeseView';
import { OrariView } from '@/components/modules/orari/OrariView';
import { TrattamentiView } from '@/components/modules/trattamenti/TrattamentiView';
import { PostazioniView } from '@/components/modules/postazioni/PostazioniView';
import { FornitoriView } from '@/components/modules/fornitori/FornitoriView';
import { StatisticheView } from '@/components/modules/statistiche/StatisticheView';
import { RecensioniView } from '@/components/modules/recensioni/RecensioniView';
import { ProfiloView } from '@/components/modules/profilo/ProfiloView';
import {
  getWeekDays,
  getTodayDayKey,
  getTodayIsoDate,
  defaultSalonHours,
  DAY_NAMES,
} from '@/lib/agendaDays';

export default function Home() { return <StaffGate><Dashboard /></StaffGate>; }

function Dashboard() {
  const pendingBookings = useRef(new Map<string, string>());
  const [activeVenueId, setActiveVenueId] = useState<string>(mockVenues[0].id);
  const [currentSection, setCurrentSection] = useState<SectionId>('agenda');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'giornaliero' | 'settimanale'>('settimanale');

  // Calendar anchor date and dynamic week days
  const [anchorDate, setAnchorDate] = useState<Date>(new Date());
  const currentWeekDays = useMemo(() => getWeekDays(anchorDate), [anchorDate]);
  const [selectedDay, setSelectedDay] = useState<string>(getTodayDayKey());

  // Real Database State (Loaded from Supabase)
  const [services, setServices] = useState<ServiceItem[]>([]);
  const [staffList, setStaffList] = useState<StaffMember[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [appointments, setAppointments] = useState<Appointment[]>([]);

  // Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDayOverviewOpen, setIsDayOverviewOpen] = useState(false);
  const [isFlashPromoOpen, setIsFlashPromoOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);
  const [cassaSelectedClientId, setCassaSelectedClientId] = useState<string | null>(null);

  // Salon working hours & day overrides
  const [salonHours, setSalonHours] = useState<DaySchedule[]>(defaultSalonHours);
  const [dayOverrides, setDayOverrides] = useState<{
    [dayKey: string]: { isOpen: boolean; openTime: string; closeTime: string };
  }>({});

  const handleStepDay = (direction: 1 | -1) => {
    if (viewMode === 'settimanale') {
      setAnchorDate((prev) => {
        const next = new Date(prev);
        next.setDate(prev.getDate() + direction * 7);
        return next;
      });
    } else {
      setSelectedDay((prev) => {
        const idx = currentWeekDays.findIndex((d) => d.key === prev);
        const nextIdx = Math.min(
          currentWeekDays.length - 1,
          Math.max(0, (idx === -1 ? 0 : idx) + direction)
        );
        return currentWeekDays[nextIdx].key;
      });
    }
  };

  // 1. Initial Data Load (Session, Services, Staff, Clients)
  useEffect(() => {
    let isMounted = true;

    const initializeData = async () => {
      try {
        // Carica Servizi reali
        const srvRes = await fetch('/api/v1/services');
        let loadedServices: ServiceItem[] = [];
        if (srvRes.ok) {
          const srvData = await srvRes.json();
          if (srvData.services) {
            loadedServices = srvData.services.map(
              (s: {
                id: string;
                name: string;
                short_name?: string | null;
                category?: string;
                category_color?: string | null;
                price?: number;
                duration_minutes: number;
                posa_minutes?: number | null;
                sanificazione?: boolean;
                has_variants?: boolean;
                is_quick_choice?: boolean;
                is_bookable_online?: boolean;
              }) => ({
                id: s.id,
                name: s.name,
                shortname: s.short_name || s.name.substring(0, 3).toUpperCase(),
                category: s.category || 'Generale',
                categoryColor: s.category_color || '#3B82F6',
                price: Number(s.price) || 0,
                durationMinutes: s.duration_minutes,
                duration: `${Math.floor(s.duration_minutes / 60).toString().padStart(2, '0')}:${(s.duration_minutes % 60).toString().padStart(2, '0')}`,
                posaMinutes: s.posa_minutes || 0,
                posaDuration: s.posa_minutes
                  ? `${Math.floor(s.posa_minutes / 60).toString().padStart(2, '0')}:${(s.posa_minutes % 60).toString().padStart(2, '0')}`
                  : undefined,
                sanificazione: !!s.sanificazione,
                hasVariants: !!s.has_variants,
                isQuickChoice: !!s.is_quick_choice,
                isOnline: !!s.is_bookable_online,
              })
            );
            if (isMounted) setServices(loadedServices);
          }
        }

        // Carica Staff / Operatori reali (Gianluca Tadonio e Sara Tadonio con UUID reali)
        const opRes = await fetch('/api/v1/operators');
        let loadedStaff: StaffMember[] = [];
        if (opRes.ok) {
          const opData = await opRes.json();
          if (opData.operators) {
            loadedStaff = opData.operators.map((op: { id: string; name: string }) => {
              const parts = op.name.split(' ');
              const name = parts[0] || op.name;
              const surname = parts.slice(1).join(' ') || '';
              const initials = parts.map((p: string) => p[0]).join('').toUpperCase() || 'OP';
              const isTitolare = op.name.toLowerCase().includes('gianluca');

              return {
                id: op.id,
                name: op.name,
                surname,
                role: isTitolare ? 'Titolare' : 'Collaboratore',
                isReceptionist: false,
                initials,
                utilizationPercentage: 85,
                commissionPercentage: 0,
                phone: '+39 06 1234567',
                email: `${name.toLowerCase()}@turbobooking.it`,
                workingHours: {
                  LUN: 'Chiuso',
                  MAR: '07:00 - 20:00',
                  MER: '07:00 - 20:00',
                  GIO: '07:00 - 20:00',
                  VEN: '07:00 - 20:00',
                  SAB: '08:00 - 18:00',
                  DOM: 'Chiuso',
                },
                vacations: [],
                activeServiceIds: [],
              };
            });
            if (isMounted) setStaffList(loadedStaff);
          }
        }

        // Carica Clienti reali
        const custRes = await fetch('/api/v1/customers');
        let loadedClients: Client[] = [];
        if (custRes.ok) {
          const custData = await custRes.json();
          if (custData.customers) {
            loadedClients = custData.customers.map(
              (c: {
                id: string;
                first_name?: string | null;
                last_name?: string | null;
                phone?: string | null;
                email?: string | null;
                has_privacy_consent?: boolean;
                notes?: string | null;
              }) => ({
                id: c.id,
                name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente',
                phone: c.phone || '',
                email: c.email || '',
                hasPrivacyConsent: !!c.has_privacy_consent,
                notes: c.notes || undefined,
                totalVisits: 0,
                lastVisit: undefined,
              })
            );
            if (isMounted) setClients(loadedClients);
          }
        }
      } catch (err) {
        console.error('Errore durante il caricamento dati Supabase:', err);
      }
    };

    initializeData();

    return () => {
      isMounted = false;
    };
  }, []);

  // 2. Caricamento Prenotazioni Reali per la settimana corrente
  const refreshBookings = useCallback(async () => {
    if (currentWeekDays.length === 0) return;
    try {
      const startIso = romeLocalToUtc(currentWeekDays[0].isoDate, '00:00').toISOString();
      const nextMonday = new Date(`${currentWeekDays[6].isoDate}T12:00:00Z`);
      nextMonday.setUTCDate(nextMonday.getUTCDate() + 1);
      const endIso = romeLocalToUtc(nextMonday.toISOString().slice(0, 10), '00:00').toISOString();

      const res = await fetch(`/api/v1/bookings?startAt=${encodeURIComponent(startIso)}&endAt=${encodeURIComponent(endIso)}`, {
        cache: 'no-store',
      });

      if (!res.ok) return;
      const data = await res.json();
      if (!data.bookings) return;

      const appList: Appointment[] = data.bookings
        .filter((b: { status: string }) => b.status !== 'cancelled' && b.status !== 'expired')
        .map(
          (b: {
            id: string;
            service_id: string;
            operator_id: string;
            customer_id: string;
            start_at: string;
            end_at: string;
            status: string;
            notes?: string | null;
            source?: string | null;
            service_name_snapshot?: string | null;
          }) => {
          const srv = services.find((s) => s.id === b.service_id);
          const op = staffList.find((o) => o.id === b.operator_id);
          const cust = clients.find((c) => c.id === b.customer_id);

          const startDate = new Date(b.start_at);
          const endDate = new Date(b.end_at);
          const durMinutes = Math.round((endDate.getTime() - startDate.getTime()) / (60 * 1000));
          const local = Object.fromEntries(new Intl.DateTimeFormat('en-CA', {
            timeZone: 'Europe/Rome', hourCycle: 'h23', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit',
          }).formatToParts(startDate).map(p => [p.type, p.value]));
          const startTimeStr = `${local.hour}:${local.minute}`;
          const dateStr = `${local.year}-${local.month}-${local.day}`;
          const matchingDay = currentWeekDays.find(d => d.isoDate === dateStr);
          const weekday = new Date(`${dateStr}T12:00:00Z`).getUTCDay();
          const dayKey = matchingDay?.key ?? `${DAY_NAMES[(weekday + 6) % 7]} ${local.day}`;

          return {
            id: b.id,
            clientId: b.customer_id,
            clientName: cust?.name || 'Cliente',
            clientPhone: cust?.phone || '',
            clientEmail: cust?.email || '',
            hasPrivacyConsent: cust?.hasPrivacyConsent || false,
            serviceId: b.service_id,
            serviceName: b.service_name_snapshot || srv?.name || 'Trattamento',
            serviceShortname: srv?.shortname || 'TR',
            serviceColor: srv?.categoryColor || '#3B82F6',
            staffId: b.operator_id,
            staffInitials: op?.initials || 'OP',
            staffName: op?.name || 'Operatore',
            date: dateStr,
            dayOfWeek: dayKey,
            startTime: startTimeStr,
            durationMinutes: durMinutes > 0 ? durMinutes : (srv?.durationMinutes || 45),
            durationFormatted: `${Math.floor(durMinutes / 60)}.${(durMinutes % 60).toString().padStart(2, '0')}h`,
            cleaningMinutes: 0,
            feePercentage: 0,
            notes: b.notes || '',
            source: b.source === 'whatsapp' ? 'ONLINE' : 'DIRECT',
            status: b.status === 'confirmed' ? 'confirmed' : 'pending',
          };
        });

      setAppointments(appList);
    } catch (err) {
      console.error('Errore sincronizzazione prenotazioni:', err);
    }
  }, [currentWeekDays, services, staffList, clients]);

  // Sincronizzazione automatica periodica con Supabase
  useEffect(() => {
    refreshBookings();
    const interval = setInterval(refreshBookings, 6000);
    return () => clearInterval(interval);
  }, [refreshBookings]);

  const handleSelectAppointment = (app: Appointment) => {
    setActiveAppointment(app);
    setIsAppointmentModalOpen(true);
  };

  const handleNewAppointmentAt = (day: string, time: string, staffId: string) => {
    const staff = staffList.find((s) => s.id === staffId) || staffList[0];
    const defaultSrv = services[0];
    if (!staff || !defaultSrv) {
      alert('Caricamento catalogo e staff in corso...');
      return;
    }

    const dayObj = currentWeekDays.find((d) => d.key === day);
    const targetDate = dayObj?.isoDate || getTodayIsoDate();

    const newApp: Appointment = {
      id: `app-${Date.now()}`,
      clientId: '',
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      hasPrivacyConsent: false,
      serviceId: defaultSrv.id,
      serviceName: defaultSrv.name,
      serviceShortname: defaultSrv.shortname,
      serviceColor: defaultSrv.categoryColor,
      staffId: staff.id,
      staffInitials: staff.initials,
      staffName: staff.name,
      date: targetDate,
      dayOfWeek: day,
      startTime: time,
      durationFormatted: `${Math.floor(defaultSrv.durationMinutes / 60)}.${(defaultSrv.durationMinutes % 60).toString().padStart(2, '0')}h`,
      durationMinutes: defaultSrv.durationMinutes,
      cleaningMinutes: 0,
      feePercentage: 0,
      source: 'DIRECT',
      status: 'confirmed',
    };
    setActiveAppointment(newApp);
    setIsAppointmentModalOpen(true);
  };

  // 5. Creazione prenotazione tramite RPC tb_create_booking
  const handleSaveAppointment = async (app: Appointment) => {
    const startIso = romeLocalToUtc(app.date!, app.startTime).toISOString();
    const intent = JSON.stringify([app.id, app.clientId, app.staffId, app.serviceId, startIso, app.notes || null]);
    const idempotencyKey = pendingBookings.current.get(intent) ?? crypto.randomUUID();
    pendingBookings.current.set(intent, idempotencyKey);

    const saveRequest = bookingSaveRequest(app, appointments.find(a => a.id === app.id), idempotencyKey);
    const res = await fetch(saveRequest.url, {
      method: saveRequest.method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(saveRequest.body),
    });

    const data = await res.json();
    if (!res.ok || !data.success) {
      const errMsg =
        res.status === 409
          ? 'Conflitto di prenotazione: orario non disponibile o sovrapposizione rilevata con un altro appuntamento.'
          : data.error || 'Errore durante la creazione della prenotazione.';
      throw new Error(errMsg);
    }

    await refreshBookings();
  };

  // 6. Spostamento / Drag & Drop tramite RPC tb_change_booking con ripristino su errore
  const handleUpdateAppointment = async (updatedApp: Appointment) => {
    const previousApp = appointments.find((a) => a.id === updatedApp.id);
    if (!previousApp) return;

    // Aggiornamento ottimistico dell'UI per garantire fluidità
    setAppointments((prev) =>
      prev.map((a) => (a.id === updatedApp.id ? updatedApp : a))
    );

    try {
      const startIso = romeLocalToUtc(updatedApp.date!, updatedApp.startTime).toISOString();
      const startMs = new Date(startIso).getTime();
      const endMs = startMs + updatedApp.durationMinutes * 60 * 1000;
      const endIso = new Date(endMs).toISOString();

      const res = await fetch(`/api/v1/bookings/${updatedApp.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'reschedule',
          startAt: startIso,
          ...(updatedApp.durationMinutes !== previousApp.durationMinutes ? { endAt: endIso } : {}),
          operatorId: updatedApp.staffId,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        // SE FALLISCE (es. 409 Conflict): RIPRISTINA IMMEDIATAMENTE LA POSIZIONE PRECEDENTE
        setAppointments((prev) =>
          prev.map((a) => (a.id === updatedApp.id ? previousApp : a))
        );
        const reason =
          res.status === 409
            ? 'Spostamento rifiutato: sovrapposizione rilevata o operatore fuori orario di lavoro.'
            : data.error || 'Errore durante lo spostamento.';
        alert(reason);
        return;
      }

      await refreshBookings();
    } catch {
      // In caso di errore di rete: ripristina la posizione precedente
      setAppointments((prev) =>
        prev.map((a) => (a.id === updatedApp.id ? previousApp : a))
      );
      alert('Errore di connessione: ripristino alla posizione precedente.');
    }
  };

  // Cancellazione prenotazione via RPC tb_change_booking (action: 'cancel')
  const handleDeleteAppointment = async (appId: string) => {
    try {
      const res = await fetch(`/api/v1/bookings/${appId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'cancel',
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        alert(`Errore durante la cancellazione: ${data.error || 'errore del server'}`);
        return;
      }

      setAppointments((prev) => prev.filter((a) => a.id !== appId));
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'errore di connessione';
      alert(`Errore durante la cancellazione: ${msg}`);
    }
  };

  const handleSendToCassa = (app: Appointment) => {
    setCassaSelectedClientId(app.clientId);
    setCurrentSection('cassa');
  };

  const handleClientAdded = (newClient: Client) => {
    setClients((prev) => [newClient, ...prev.filter((c) => c.id !== newClient.id)]);
  };

  const handleSaveDaySchedule = (params: {
    dayKey: string;
    dayName: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    applyToAllMatchingDays: boolean;
  }) => {
    if (params.applyToAllMatchingDays) {
      setSalonHours((prev) =>
        prev.map((item) => {
          if (
            item.shortName.toUpperCase() === params.dayName.toUpperCase() ||
            item.day.toLowerCase() === params.dayName.toLowerCase()
          ) {
            return {
              ...item,
              isOpen: params.isOpen,
              openTime: params.openTime,
              closeTime: params.closeTime,
              hours: params.isOpen ? `${params.openTime} - ${params.closeTime}` : 'Chiuso',
            };
          }
          return item;
        })
      );
      setDayOverrides((prev) => {
        const next = { ...prev };
        delete next[params.dayKey];
        return next;
      });
    } else {
      setDayOverrides((prev) => ({
        ...prev,
        [params.dayKey]: {
          isOpen: params.isOpen,
          openTime: params.openTime,
          closeTime: params.closeTime,
        },
      }));
    }
  };

  const handleResetDayOverride = (dayKey: string) => {
    setDayOverrides((prev) => {
      const next = { ...prev };
      delete next[dayKey];
      return next;
    });
  };

  const weekRangeLabel = `${currentWeekDays[0]?.key || ''} → ${currentWeekDays[6]?.key || ''}`;

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-tw-canvas antialiased text-tw-text-main font-sans">
      {/* 1. Left Venue Rail */}
      <VenueRail
        venues={mockVenues}
        activeVenueId={activeVenueId}
        onSelectVenue={setActiveVenueId}
      />

      {/* 2. Main Content Column */}
      <div className="flex-1 flex flex-col h-full overflow-hidden">
        {/* Top Header */}
        <TopHeader
          currentSection={currentSection}
          onOpenDrawer={() => setIsDrawerOpen(true)}
          onOpenFlashPromo={() => setIsFlashPromoOpen(true)}
          onOpenDayOverview={() => setIsDayOverviewOpen(true)}
          selectedStaffFilter={selectedStaffFilter}
          onSelectStaffFilter={setSelectedStaffFilter}
          viewMode={viewMode}
          onToggleViewMode={() =>
            setViewMode((prev) => (prev === 'settimanale' ? 'giornaliero' : 'settimanale'))
          }
          onSelectViewMode={setViewMode}
          selectedDay={selectedDay}
          onPrevDay={() => handleStepDay(-1)}
          onNextDay={() => handleStepDay(1)}
          weekRangeLabel={weekRangeLabel}
          monthLabel="SET"
        />

        {/* Dynamic Section View */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {currentSection === 'agenda' && (
            <AgendaView
              appointments={appointments}
              staffList={staffList}
              selectedStaffFilter={selectedStaffFilter}
              onSelectAppointment={handleSelectAppointment}
              onNewAppointmentAt={handleNewAppointmentAt}
              onUpdateAppointment={handleUpdateAppointment}
              viewMode={viewMode}
              selectedDay={selectedDay}
              salonHours={salonHours}
              dayOverrides={dayOverrides}
              agendaDays={currentWeekDays}
              onSaveDaySchedule={handleSaveDaySchedule}
              onResetDayOverride={handleResetDayOverride}
            />
          )}

          {currentSection === 'cassa' && (
            <CassaView
              clients={clients}
              appointments={appointments}
              selectedClientId={cassaSelectedClientId}
              onSelectClient={setCassaSelectedClientId}
            />
          )}

          {currentSection === 'rubrica' && (
            <RubricaView clients={clients} onAddClient={handleClientAdded} />
          )}

          {currentSection === 'promozioni' && <PromozioniView />}

          {currentSection === 'masterclass' && <MasterclassView />}

          {currentSection === 'magazzino-prodotti' && <MagazzinoView subSection="prodotti" />}
          {currentSection === 'magazzino-ordini' && <MagazzinoView subSection="ordini" />}
          {currentSection === 'magazzino-scadenzario' && <MagazzinoView subSection="scadenzario" />}

          {currentSection === 'comunicazioni' && <ComunicazioniView />}

          {currentSection === 'staff' && (
            <StaffView staffList={staffList} services={services} />
          )}

          {currentSection === 'spese' && <SpeseView />}

          {currentSection === 'orari' && (
            <OrariView
              subSection="orari"
              salonHours={salonHours}
              onUpdateSalonHours={setSalonHours}
            />
          )}
          {currentSection === 'orari-aperture' && (
            <OrariView
              subSection="aperture"
              salonHours={salonHours}
              onUpdateSalonHours={setSalonHours}
            />
          )}
          {currentSection === 'orari-chiusure' && (
            <OrariView
              subSection="chiusure"
              salonHours={salonHours}
              onUpdateSalonHours={setSalonHours}
            />
          )}

          {currentSection === 'trattamenti' && <TrattamentiView services={services} />}

          {currentSection === 'postazioni' && <PostazioniView />}

          {currentSection === 'fornitori' && <FornitoriView subSection="fornitori" />}
          {currentSection === 'produttori' && <FornitoriView subSection="produttori" />}
          {currentSection === 'spedizioni' && <FornitoriView subSection="spedizioni" />}

          {currentSection === 'statistiche-andamento' && (
            <StatisticheView subSection="andamento" />
          )}
          {currentSection === 'statistiche-azienda' && <StatisticheView subSection="azienda" />}
          {currentSection === 'statistiche-corrispettivi' && (
            <StatisticheView subSection="corrispettivi" />
          )}
          {currentSection === 'statistiche-collaboratori' && (
            <StatisticheView subSection="collaboratori" />
          )}
          {currentSection === 'statistiche-clienti' && <StatisticheView subSection="clienti" />}
          {currentSection === 'statistiche-magazzino' && (
            <StatisticheView subSection="magazzino" />
          )}
          {currentSection === 'statistiche-inventario' && (
            <StatisticheView subSection="inventario" />
          )}

          {currentSection === 'recensioni' && <RecensioniView />}

          {currentSection.startsWith('profilo') && <ProfiloView />}
        </main>
      </div>

      {/* 3. Main Drawer Menu (Sliding from Right) */}
      <MainDrawerMenu
        isOpen={isDrawerOpen}
        onClose={() => setIsDrawerOpen(false)}
        currentSection={currentSection}
        onSelectSection={(section) => setCurrentSection(section)}
      />

      {/* 4. Modals */}
      <DayOverviewModal
        isOpen={isDayOverviewOpen}
        onClose={() => setIsDayOverviewOpen(false)}
        appointments={appointments}
        onOpenFlashPromo={() => setIsFlashPromoOpen(true)}
      />

      <FlashPromoModal
        isOpen={isFlashPromoOpen}
        onClose={() => setIsFlashPromoOpen(false)}
        onSavePromo={(promo) => {
          alert(`Promo Flash attivata: ${promo.discount} per ${promo.duration}`);
        }}
      />

      <AppointmentModal
        isOpen={isAppointmentModalOpen}
        onClose={() => {
          setIsAppointmentModalOpen(false);
          setActiveAppointment(null);
        }}
        appointment={activeAppointment}
        services={services}
        staffList={staffList}
        clients={clients}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        onSendToCassa={handleSendToCassa}
      />
    </div>
  );
}
