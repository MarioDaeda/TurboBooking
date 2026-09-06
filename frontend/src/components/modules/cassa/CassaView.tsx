'use client';

import React, { useState } from 'react';
import { CreditCard, Search, Plus, CheckCircle2 } from 'lucide-react';
import { Client, Appointment } from '@/types';

interface CassaViewProps {
  clients: Client[];
  appointments: Appointment[];
  selectedClientId?: string | null;
  onSelectClient?: (clientId: string) => void;
}

export const CassaView: React.FC<CassaViewProps> = ({
  clients,
  appointments,
  selectedClientId: propSelectedClientId,
  onSelectClient,
}) => {
  const [activeTab, setActiveTab] = useState<'clienti' | 'ricevute'>('clienti');
  const [searchQuery, setSearchQuery] = useState('');
  const [internalSelectedClientId, setInternalSelectedClientId] = useState<string | null>(
    propSelectedClientId || appointments[0]?.clientId || clients[0]?.id || null
  );
  const [checkoutSuccess, setCheckoutSuccess] = useState<string | null>(null);

  // Sync prop changes
  React.useEffect(() => {
    if (propSelectedClientId) {
      setInternalSelectedClientId(propSelectedClientId);
      setCheckoutSuccess(null);
    }
  }, [propSelectedClientId]);

  const activeClientId = internalSelectedClientId;

  const handleSelectClient = (id: string) => {
    setInternalSelectedClientId(id);
    setCheckoutSuccess(null);
    onSelectClient?.(id);
  };

  // Auth protection state for "RICEVUTE EMESSE"
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [email, setEmail] = useState('tadoniogianluca93@gmail.com');
  const [password, setPassword] = useState('');

  const inSalonList = appointments.filter((app) => {
    if (!searchQuery) return true;
    return (
      app.clientName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      app.serviceName.toLowerCase().includes(searchQuery.toLowerCase())
    );
  });

  const selectedAppointment = appointments.find((a) => a.clientId === activeClientId);
  const selectedClient =
    clients.find((c) => c.id === activeClientId) ||
    (selectedAppointment
      ? {
          id: selectedAppointment.clientId,
          name: selectedAppointment.clientName,
          phone: selectedAppointment.clientPhone,
          email: selectedAppointment.clientEmail,
          hasPrivacyConsent: selectedAppointment.hasPrivacyConsent,
          lastVisit: 'Oggi',
          totalVisits: 1,
        }
      : null);

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
        {/* Tabs */}
        <div className="flex border-b border-gray-200 text-xs font-semibold">
          <button
            onClick={() => setActiveTab('clienti')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'clienti'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            CLIENTI IN SALONE
          </button>
          <button
            onClick={() => setActiveTab('ricevute')}
            className={`flex-1 py-3 text-center border-b-2 transition ${
              activeTab === 'ricevute'
                ? 'border-tw-blue text-tw-blue'
                : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            RICEVUTE EMESSE
          </button>
        </div>

        {/* Tab 1: Clienti in salone */}
        {activeTab === 'clienti' && (
          <div className="p-4 flex flex-col h-full">
            <div className="flex items-center gap-2 mb-4">
              <div className="relative flex-1">
                <input
                  type="text"
                  placeholder="Cerca cliente"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
              </div>
              <button
                onClick={() => alert('Aggiungi nuovo cliente in cassa')}
                className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>

            {/* List of in-salon clients */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {inSalonList.length > 0 ? (
                inSalonList.map((app) => (
                  <div
                    key={app.id}
                    onClick={() => handleSelectClient(app.clientId)}
                    className={`p-3 rounded-xl cursor-pointer transition ${
                      activeClientId === app.clientId
                        ? 'bg-tw-blue-light text-tw-blue font-semibold'
                        : 'hover:bg-gray-50'
                    }`}
                  >
                    <div className="font-bold text-xs">{app.clientName || 'Cliente'}</div>
                    <div className="text-[11px] text-gray-500 mt-0.5">
                      {app.serviceName} • {app.startTime} ({app.staffName})
                    </div>
                  </div>
                ))
              ) : (
                <div className="p-4 text-center text-xs text-gray-400">
                  Nessun cliente in salone
                </div>
              )}
            </div>
          </div>
        )}

        {/* Tab 2: Ricevute Emesse */}
        {activeTab === 'ricevute' && (
          <div className="p-6 flex flex-col justify-center h-full">
            {!isAuthenticated ? (
              <div className="space-y-4">
                <div className="text-center space-y-1">
                  <div className="font-bold text-xs text-gray-800">
                    Sezione protetta da autenticazione
                  </div>
                  <p className="text-[11px] text-gray-500 leading-relaxed">
                    Questa sezione è protetta da autenticazione, inserisci le tue credenziali per
                    accedere.
                  </p>
                </div>

                <div className="space-y-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                  />
                  <input
                    type="password"
                    placeholder="Password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full bg-white border border-gray-200 rounded-full px-3 py-1.5 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                  />
                </div>

                <button
                  onClick={() => setIsAuthenticated(true)}
                  className="w-full py-2 bg-tw-blue-pill hover:bg-tw-blue text-tw-blue hover:text-white text-xs font-bold uppercase rounded-full transition"
                >
                  ACCEDI
                </button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="flex items-center gap-2 text-emerald-600 text-xs font-bold justify-center mb-2">
                  <CheckCircle2 className="w-4 h-4" />
                  <span>Autenticato</span>
                </div>
                <div className="p-3 border border-gray-200 rounded-xl space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Ricevuta #1042</span>
                    <span className="text-tw-blue">€ 38,00</span>
                  </div>
                  <div className="text-[10px] text-gray-500">Morena • Acconciatura • Contanti</div>
                </div>
                <div className="p-3 border border-gray-200 rounded-xl space-y-1">
                  <div className="flex justify-between text-xs font-bold">
                    <span>Ricevuta #1041</span>
                    <span className="text-tw-blue">€ 10,00</span>
                  </div>
                  <div className="text-[10px] text-gray-500">
                    Bardi Daniele • Barba • Carta Pos
                  </div>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas">
        {selectedClient ? (
          <div className="w-full max-w-lg bg-white rounded-2xl shadow-sm border border-gray-200 p-6 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h3 className="font-bold text-base text-gray-800">{selectedClient.name}</h3>
                <p className="text-xs text-gray-500">{selectedClient.phone || 'Nessun telefono registrato'}</p>
              </div>
              <span className="text-xs font-bold text-tw-blue px-3 py-1 bg-tw-blue-light rounded-full">
                Pronto per il pagamento
              </span>
            </div>

            {checkoutSuccess && (
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-center gap-2 text-xs font-semibold text-emerald-700 animate-in fade-in">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>Incasso registrato con successo tramite {checkoutSuccess}! Ricevuta generata.</span>
              </div>
            )}

            <div className="space-y-3">
              <div className="flex justify-between text-xs text-gray-700 py-1 border-b border-gray-100">
                <span>Trattamento eseguito:</span>
                <span className="font-semibold">
                  {selectedAppointment?.serviceName || 'Trattamento Salone'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-700 py-1 border-b border-gray-100">
                <span>Operatore:</span>
                <span className="font-semibold">
                  {selectedAppointment?.staffName || 'Gianluca Tadonio'}
                </span>
              </div>
              <div className="flex justify-between text-xs text-gray-700 py-1 border-b border-gray-100">
                <span>Orario:</span>
                <span className="font-semibold">
                  {selectedAppointment?.dayOfWeek || 'Oggi'} • {selectedAppointment?.startTime || '08:00'}
                </span>
              </div>
              <div className="flex justify-between text-base font-bold text-gray-900 pt-2">
                <span>Totale da incassare:</span>
                <span className="text-tw-blue font-bold text-lg">€ 45,00</span>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-3 pt-2">
              <button
                onClick={() => setCheckoutSuccess('Contanti')}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-semibold text-xs text-gray-800 transition"
              >
                Contanti
              </button>
              <button
                onClick={() => setCheckoutSuccess('Carta / POS')}
                className="py-2.5 bg-tw-blue hover:bg-tw-blue-hover text-white rounded-xl font-semibold text-xs shadow-sm transition"
              >
                Carta / POS
              </button>
              <button
                onClick={() => setCheckoutSuccess('Fattura Elettronica')}
                className="py-2.5 bg-gray-50 hover:bg-gray-100 border border-gray-200 rounded-xl font-semibold text-xs text-gray-800 transition"
              >
                Fattura
              </button>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <CreditCard className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Seleziona un cliente dall&apos;elenco o{' '}
              <button
                onClick={() => alert('Nuovo cliente in cassa')}
                className="text-tw-blue font-medium hover:underline"
              >
                aggiungine uno nuovo
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
