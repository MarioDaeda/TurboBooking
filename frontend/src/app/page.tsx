'use client';

import React, { useState } from 'react';
import { SectionId, Appointment, Client } from '@/types';
import {
  mockVenues,
  mockStaff,
  mockServices,
  mockClients,
  mockAppointments,
} from '@/data/mockData';
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
import { AGENDA_DAYS, getTodayDayKey, getTodayIsoDate } from '@/lib/agendaDays';

export default function Home() {
  const [activeVenueId, setActiveVenueId] = useState<string>(mockVenues[0].id);
  const [currentSection, setCurrentSection] = useState<SectionId>('agenda');
  const [selectedStaffFilter, setSelectedStaffFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'giornaliero' | 'settimanale'>('settimanale');
  const [selectedDay, setSelectedDay] = useState<string>(getTodayDayKey());

  const handleStepDay = (direction: 1 | -1) => {
    setSelectedDay((prev) => {
      const idx = AGENDA_DAYS.findIndex((d) => d.key === prev);
      const nextIdx = Math.min(
        AGENDA_DAYS.length - 1,
        Math.max(0, (idx === -1 ? 0 : idx) + direction)
      );
      return AGENDA_DAYS[nextIdx].key;
    });
  };

  // Modals state
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [isDayOverviewOpen, setIsDayOverviewOpen] = useState(false);
  const [isFlashPromoOpen, setIsFlashPromoOpen] = useState(false);
  const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
  const [activeAppointment, setActiveAppointment] = useState<Appointment | null>(null);

  // Live state for appointments and clients
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);
  const [clients, setClients] = useState<Client[]>(mockClients);
  const [cassaSelectedClientId, setCassaSelectedClientId] = useState<string | null>(null);

  const handleSelectAppointment = (app: Appointment) => {
    setActiveAppointment(app);
    setIsAppointmentModalOpen(true);
  };

  const handleNewAppointmentAt = (day: string, time: string, staffId: string) => {
    const staff = mockStaff.find((s) => s.id === staffId) || mockStaff[0];
    const newApp: Appointment = {
      id: `app-${Date.now()}`,
      clientId: `cli-${Date.now()}`,
      clientName: '',
      clientPhone: '',
      clientEmail: '',
      hasPrivacyConsent: false,
      serviceId: mockServices[0].id,
      serviceName: mockServices[0].name,
      serviceShortname: mockServices[0].shortname,
      serviceColor: mockServices[0].categoryColor,
      staffId: staff.id,
      staffInitials: staff.initials,
      staffName: staff.name,
      date: getTodayIsoDate(),
      dayOfWeek: day,
      startTime: time,
      durationFormatted: '1.00h',
      durationMinutes: 60,
      cleaningMinutes: 0,
      feePercentage: 0,
      source: 'DIRECT',
      status: 'confirmed',
    };
    setActiveAppointment(newApp);
    setIsAppointmentModalOpen(true);
  };

  const handleSaveAppointment = (app: Appointment) => {
    setAppointments((prev) => {
      const idx = prev.findIndex((a) => a.id === app.id);
      if (idx >= 0) {
        const next = [...prev];
        next[idx] = app;
        return next;
      }
      return [...prev, app];
    });

    // Ensure client is saved in clients CRM list
    setClients((prev) => {
      const exists = prev.some(
        (c) =>
          c.id === app.clientId ||
          (app.clientName && c.name.toLowerCase() === app.clientName.toLowerCase())
      );
      if (exists) return prev;

      const newClient: Client = {
        id: app.clientId,
        name: app.clientName || 'Nuovo Cliente',
        phone: app.clientPhone || '+39 340 0000000',
        email: app.clientEmail || '',
        hasPrivacyConsent: app.hasPrivacyConsent,
        lastVisit: 'Oggi',
        totalVisits: 1,
        notes: app.notes,
      };
      return [newClient, ...prev];
    });
  };

  const handleDeleteAppointment = (appId: string) => {
    setAppointments((prev) => prev.filter((a) => a.id !== appId));
  };

  const handleSendToCassa = (app: Appointment) => {
    handleSaveAppointment(app);
    setCassaSelectedClientId(app.clientId);
    setCurrentSection('cassa');
  };

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
        />

        {/* Dynamic Section View */}
        <main className="flex-1 overflow-hidden relative flex flex-col">
          {currentSection === 'agenda' && (
            <AgendaView
              appointments={appointments}
              staffList={mockStaff}
              selectedStaffFilter={selectedStaffFilter}
              onSelectAppointment={handleSelectAppointment}
              onNewAppointmentAt={handleNewAppointmentAt}
              onUpdateAppointment={handleSaveAppointment}
              viewMode={viewMode}
              selectedDay={selectedDay}
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

          {currentSection === 'rubrica' && <RubricaView clients={clients} />}

          {currentSection === 'promozioni' && <PromozioniView />}

          {currentSection === 'masterclass' && <MasterclassView />}

          {currentSection === 'magazzino-prodotti' && <MagazzinoView subSection="prodotti" />}
          {currentSection === 'magazzino-ordini' && <MagazzinoView subSection="ordini" />}
          {currentSection === 'magazzino-scadenzario' && <MagazzinoView subSection="scadenzario" />}

          {currentSection === 'comunicazioni' && <ComunicazioniView />}

          {currentSection === 'staff' && (
            <StaffView staffList={mockStaff} services={mockServices} />
          )}

          {currentSection === 'spese' && <SpeseView />}

          {currentSection === 'orari' && <OrariView subSection="orari" />}
          {currentSection === 'orari-aperture' && <OrariView subSection="aperture" />}
          {currentSection === 'orari-chiusure' && <OrariView subSection="chiusure" />}

          {currentSection === 'trattamenti' && <TrattamentiView services={mockServices} />}

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
        services={mockServices}
        staffList={mockStaff}
        onSave={handleSaveAppointment}
        onDelete={handleDeleteAppointment}
        onSendToCassa={handleSendToCassa}
      />
    </div>
  );
}
