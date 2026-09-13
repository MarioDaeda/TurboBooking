'use client';

import React, { useState, useEffect } from 'react';
import { Users, Search, Plus, ShieldCheck, AlertCircle, Calendar, X, Check } from 'lucide-react';
import { Client } from '@/types';

interface RubricaViewProps {
  clients: Client[];
  onAddClient?: (newClient: Client) => void;
}

export const RubricaView: React.FC<RubricaViewProps> = ({ clients, onAddClient }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
  const [isNewClientModalOpen, setIsNewClientModalOpen] = useState(false);

  // New Client Form state
  const [newFirstName, setNewFirstName] = useState('');
  const [newLastName, setNewLastName] = useState('');
  const [newPhone, setNewPhone] = useState('');
  const [newEmail, setNewEmail] = useState('');
  const [newNotes, setNewNotes] = useState('');
  const [newPrivacy, setNewPrivacy] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);

  // Server search results
  const [searchResults, setSearchResults] = useState<Client[] | null>(null);

  useEffect(() => {
    if (searchQuery.trim().length >= 2) {
      const controller = new AbortController();
      const timer = setTimeout(async () => {
        try {
          const res = await fetch(`/api/v1/customers?query=${encodeURIComponent(searchQuery.trim())}`, {
            signal: controller.signal,
          });
          if (res.ok) {
            const data = await res.json();
            if (data.customers) {
              const mapped: Client[] = data.customers.map(
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
                  name: `${c.first_name || ''} ${c.last_name || ''}`.trim() || 'Cliente senza nome',
                  phone: c.phone || '',
                  email: c.email || '',
                  hasPrivacyConsent: !!c.has_privacy_consent,
                  notes: c.notes || undefined,
                  totalVisits: 0,
                  lastVisit: undefined,
                })
              );
              setSearchResults(mapped);
            }
          }
        } catch (err: unknown) {
          if (err instanceof Error && err.name !== 'AbortError') {
            console.error('Errore ricerca clienti:', err);
          }
        }
      }, 300);

      return () => {
        clearTimeout(timer);
        controller.abort();
      };
    } else {
      setSearchResults(null);
    }
  }, [searchQuery]);

  const displayedClients = searchResults !== null
    ? searchResults
    : clients.filter((c) =>
        c.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.phone.includes(searchQuery)
      );

  const selectedClient = displayedClients.find((c) => c.id === selectedClientId) ||
    clients.find((c) => c.id === selectedClientId);

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newFirstName.trim()) {
      setFormError('Il nome è obbligatorio.');
      return;
    }

    setIsSubmitting(true);
    setFormError(null);

    try {
      const res = await fetch('/api/v1/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          firstName: newFirstName.trim(),
          lastName: newLastName.trim() || undefined,
          phone: newPhone.trim() || undefined,
          email: newEmail.trim() || undefined,
          notes: newNotes.trim() || undefined,
          privacyConsent: newPrivacy,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Errore durante la creazione del cliente');
      }

      const created: Client = {
        id: data.customer.id,
        name: `${data.customer.first_name || ''} ${data.customer.last_name || ''}`.trim() || 'Nuovo Cliente',
        phone: data.customer.phone || '',
        email: data.customer.email || '',
        hasPrivacyConsent: !!data.customer.has_privacy_consent,
        notes: data.customer.notes || undefined,
        totalVisits: 0,
        lastVisit: 'Oggi',
      };

      if (onAddClient) {
        onAddClient(created);
      }
      setSelectedClientId(created.id);
      setIsNewClientModalOpen(false);

      // Reset form
      setNewFirstName('');
      setNewLastName('');
      setNewPhone('');
      setNewEmail('');
      setNewNotes('');
      setNewPrivacy(false);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Errore salvataggio cliente';
      setFormError(msg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none relative">
      {/* Sub Sidebar */}
      <div className="w-80 border-r border-gray-200 flex flex-col justify-between bg-white">
        <div className="p-4 flex-1 flex flex-col overflow-hidden">
          {/* Search bar & Add button */}
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <input
                type="text"
                placeholder="Cerca per nome o telefono..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
              <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
            </div>
            <button
              onClick={() => setIsNewClientModalOpen(true)}
              className="w-7 h-7 rounded-full border border-tw-blue text-tw-blue flex items-center justify-center hover:bg-tw-blue hover:text-white transition"
              title="Nuovo cliente"
            >
              <Plus className="w-4 h-4" />
            </button>
          </div>

          {/* Indicatore ricerca multi-corrispondenza */}
          {searchQuery.trim().length >= 2 && searchResults && searchResults.length > 1 && (
            <div className="mb-2 p-2 bg-amber-50 border border-amber-200 rounded-lg text-[10px] text-amber-800">
              Trovati {searchResults.length} contatti per questa ricerca. Seleziona quello desiderato:
            </div>
          )}

          {/* List or hint */}
          {displayedClients.length === 0 ? (
            <div className="text-center py-10 px-4 text-xs text-gray-400">
              <Users className="w-8 h-8 mx-auto text-gray-300 mb-2" />
              Nessun cliente trovato.
            </div>
          ) : (
            <div className="flex-1 overflow-y-auto divide-y divide-gray-100">
              {displayedClients.map((client) => (
                <div
                  key={client.id}
                  onClick={() => setSelectedClientId(client.id)}
                  className={`p-3 rounded-xl cursor-pointer transition ${
                    selectedClientId === client.id
                      ? 'bg-tw-blue-light text-tw-blue'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="font-bold text-xs">{client.name}</div>
                    <span className="text-[9px] text-gray-400 font-mono">
                      {client.id.slice(0, 8)}...
                    </span>
                  </div>
                  <div className="text-[11px] text-gray-500 mt-0.5">
                    {client.phone || 'Nessun telefono'}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Bottom Export Bar */}
        <div className="p-3 border-t border-gray-100 flex items-center justify-between text-xs text-gray-600 bg-gray-50/50">
          <span>Clienti censiti: {clients.length}</span>
          <button
            onClick={() => setIsNewClientModalOpen(true)}
            className="text-xs text-tw-blue font-semibold hover:underline"
          >
            + Nuovo
          </button>
        </div>
      </div>

      {/* Main Panel Content */}
      <div className="flex-1 flex flex-col items-center justify-center p-8 bg-tw-canvas overflow-y-auto">
        {selectedClient ? (
          <div className="w-full max-w-2xl bg-white rounded-2xl shadow-sm border border-gray-200 p-8 space-y-6">
            <div className="flex items-center justify-between border-b border-gray-100 pb-4">
              <div>
                <h2 className="text-xl font-bold text-gray-800">{selectedClient.name}</h2>
                <p className="text-xs text-gray-500 mt-0.5">
                  {selectedClient.phone || 'Nessun telefono'} • {selectedClient.email || 'Nessuna email'}
                </p>
                <p className="text-[10px] text-gray-400 font-mono mt-1">ID: {selectedClient.id}</p>
              </div>
              <div className="flex items-center gap-2">
                {selectedClient.hasPrivacyConsent ? (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
                    <ShieldCheck className="w-3.5 h-3.5" />
                    Consenso privacy attivo
                  </span>
                ) : (
                  <span className="flex items-center gap-1.5 text-xs font-medium text-amber-700 bg-amber-50 px-3 py-1 rounded-full border border-amber-200">
                    <AlertCircle className="w-3.5 h-3.5" />
                    Consenso privacy non registrato
                  </span>
                )}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  VISITE TOTALI
                </span>
                <div className="text-2xl font-bold text-gray-800 mt-1">{selectedClient.totalVisits}</div>
              </div>
              <div className="p-4 bg-gray-50 rounded-xl border border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  ULTIMA VISITA
                </span>
                <div className="text-base font-semibold text-gray-800 mt-1.5 flex items-center gap-2">
                  <Calendar className="w-4 h-4 text-gray-400" />
                  <span>{selectedClient.lastVisit || 'Nessuna'}</span>
                </div>
              </div>
            </div>

            <div className="space-y-2">
              <span className="text-xs font-bold text-gray-700 uppercase tracking-wide">
                Note Tecniche / Preferenze
              </span>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-xl text-xs text-gray-600">
                {selectedClient.notes || 'Nessuna nota tecnica registrata.'}
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center text-center space-y-4">
            <div className="w-20 h-16 rounded-xl border-2 border-dashed border-gray-300 flex items-center justify-center text-gray-300">
              <Users className="w-10 h-10" />
            </div>
            <div className="text-xs text-gray-500">
              Seleziona un cliente dall&apos;elenco o{' '}
              <button
                onClick={() => setIsNewClientModalOpen(true)}
                className="text-tw-blue font-medium hover:underline"
              >
                aggiungine uno nuovo
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal Nuovo Cliente */}
      {isNewClientModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-xs">
          <div className="bg-white rounded-2xl shadow-xl border border-gray-200 w-full max-w-md p-6 space-y-4 animate-in fade-in zoom-in-95">
            <div className="flex items-center justify-between border-b border-gray-100 pb-3">
              <h3 className="font-bold text-sm text-gray-800 uppercase tracking-wider">Nuovo Cliente</h3>
              <button
                onClick={() => setIsNewClientModalOpen(false)}
                className="p-1 text-gray-400 hover:text-gray-700 rounded-lg"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            {formError && (
              <div className="p-2.5 bg-red-50 border border-red-200 text-red-700 text-xs rounded-xl">
                {formError}
              </div>
            )}

            <form onSubmit={handleCreateCustomer} className="space-y-3">
              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Nome *</label>
                  <input
                    type="text"
                    required
                    value={newFirstName}
                    onChange={(e) => setNewFirstName(e.target.value)}
                    placeholder="Mario"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-gray-600 mb-1">Cognome</label>
                  <input
                    type="text"
                    value={newLastName}
                    onChange={(e) => setNewLastName(e.target.value)}
                    placeholder="Rossi"
                    className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                  />
                </div>
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Telefono</label>
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="+39 340 0000000"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Email</label>
                <input
                  type="email"
                  value={newEmail}
                  onChange={(e) => setNewEmail(e.target.value)}
                  placeholder="cliente@email.com"
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue"
                />
              </div>

              <div>
                <label className="block text-[11px] font-bold text-gray-600 mb-1">Note Tecniche</label>
                <textarea
                  value={newNotes}
                  onChange={(e) => setNewNotes(e.target.value)}
                  placeholder="Note, formule colore, allergie..."
                  rows={2}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-3 py-2 text-xs text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue resize-none"
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <input
                  type="checkbox"
                  id="privacyConsent"
                  checked={newPrivacy}
                  onChange={(e) => setNewPrivacy(e.target.checked)}
                  className="w-3.5 h-3.5 text-tw-blue rounded"
                />
                <label htmlFor="privacyConsent" className="text-xs text-gray-600">
                  Consenso al trattamento dei dati personali (Privacy)
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 pt-3 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => setIsNewClientModalOpen(false)}
                  className="px-3 py-1.5 rounded-xl border border-gray-200 text-xs font-semibold text-gray-600 hover:bg-gray-50"
                >
                  Annulla
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-4 py-1.5 rounded-xl bg-tw-blue text-white text-xs font-bold hover:bg-tw-blue-hover flex items-center gap-1.5 shadow-xs disabled:opacity-50"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{isSubmitting ? 'Salvataggio...' : 'Salva Cliente'}</span>
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
