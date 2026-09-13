'use client';

import React, { useState } from 'react';
import { Download, Check, ArrowDownToLine, Copy, MessageCircle, Edit2, Trash2 } from 'lucide-react';
import { mockVenues, mockInvoices } from '@/data/mockData';

const FacebookIcon = () => (
  <svg className="w-5 h-5 text-blue-600 fill-current" viewBox="0 0 24 24">
    <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
  </svg>
);

const InstagramIcon = () => (
  <svg className="w-5 h-5 text-pink-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export const ProfiloView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'profilo' | 'fatturazione' | 'impostazioni' | 'vetrina' | 'utenti'>('profilo');
  const [shortname, setShortname] = useState('GT');
  const [salonType, setSalonType] = useState('Unisex');
  const [copiedLink, setCopiedLink] = useState(false);

  const venue = mockVenues[0];

  const handleCopy = () => {
    navigator.clipboard?.writeText('https://trea.tw/PS7ey8EtPCehmq6Eq');
    setCopiedLink(true);
    setTimeout(() => setCopiedLink(false), 2000);
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto select-none p-4 md:p-8">
      <div className="max-w-5xl mx-auto w-full space-y-6">
        {/* Header Salone Card */}
        <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
          <div className="flex items-start justify-between">
            <div className="flex items-center gap-4">
              <div className="w-16 h-16 rounded-full overflow-hidden border border-gray-200 flex-shrink-0">
                <img
                  src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=200&auto=format&fit=crop&q=80"
                  alt="Logo Salone"
                  className="w-full h-full object-cover"
                />
              </div>
              <div>
                <h2 className="text-lg font-bold text-gray-900 leading-tight">{venue.name}</h2>
                <p className="text-xs text-gray-500">{venue.address}, {venue.zipCity}</p>
                <button
                  onClick={() => alert('Vedi profilo online')}
                  className="text-[10px] text-tw-blue font-bold uppercase tracking-wide hover:underline mt-1 block"
                >
                  VEDI PROFILO ONLINE
                </button>
              </div>
            </div>

            <button
              onClick={() => alert('Download scheda')}
              className="p-2 text-gray-400 hover:text-gray-700 hover:bg-gray-50 rounded-xl"
              title="Download"
            >
              <Download className="w-5 h-5" />
            </button>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-xs pt-2 border-t border-gray-100 [&>div]:min-w-0">
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                RAGIONE SOCIALE
              </span>
              <span className="font-semibold text-gray-800">{venue.legalName}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                EMAIL
              </span>
              <span className="font-semibold text-gray-800 truncate block">{venue.email}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                TELEFONO
              </span>
              <span className="font-semibold text-gray-800">{venue.phone}</span>
            </div>
            <div>
              <span className="text-[9px] font-bold text-gray-400 uppercase tracking-wider block">
                IBAN
              </span>
              <span className="font-semibold text-gray-800 font-mono text-[11px] truncate block">
                {venue.iban}
              </span>
            </div>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="flex md:justify-center border-b border-gray-200 text-xs font-semibold overflow-x-auto no-scrollbar">
          {[
            { key: 'profilo', label: 'PROFILO' },
            { key: 'fatturazione', label: 'FATTURAZIONE' },
            { key: 'impostazioni', label: 'IMPOSTAZIONI' },
            { key: 'vetrina', label: 'VETRINA' },
            { key: 'utenti', label: 'UTENTI' },
          ].map((t) => (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key as 'profilo' | 'fatturazione' | 'impostazioni' | 'vetrina' | 'utenti')}
              className={`px-4 md:px-6 py-3 border-b-2 uppercase tracking-wider transition shrink-0 whitespace-nowrap ${
                activeTab === t.key
                  ? 'border-tw-blue text-tw-blue font-bold'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {/* Tab 1: PROFILO & Piani Attivi */}
        {activeTab === 'profilo' && (
          <div className="space-y-4">
            <div className="flex justify-center gap-2 mb-4">
              <span className="px-4 py-1 rounded-full bg-gray-200 text-gray-800 text-xs font-bold uppercase">
                PIANI ATTIVI
              </span>
              <span className="px-4 py-1 rounded-full text-gray-400 hover:text-gray-700 text-xs font-bold uppercase cursor-pointer">
                AGGIUNGI SERVIZI
              </span>
            </div>

            {/* Active subscription card 1: IT PREMIUM */}
            <div className="bg-tw-blue rounded-2xl p-6 text-white shadow-md flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-white/20 flex items-center justify-center font-bold text-lg">
                  tw
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-white/80">
                    SERVIZIO BASE
                  </span>
                  <h3 className="text-xl font-bold">IT PREMIUM</h3>
                </div>
              </div>
              <div className="text-right">
                <span className="text-[10px] uppercase font-bold tracking-wider text-white/80 block">
                  ATTIVAZIONE
                </span>
                <span className="text-sm font-semibold">17/06/2026</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-400/30 text-white font-bold text-[10px] uppercase border border-emerald-300/40">
                ATTIVO
              </span>
            </div>

            {/* Add-on 1 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-tw-blue flex items-center justify-center font-bold text-xl">
                  +
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    SERVIZIO AGGIUNTIVO
                  </span>
                  <h4 className="text-sm font-bold text-gray-800">Add-on Treatwell Marketplace</h4>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                  ATTIVAZIONE
                </span>
                <span className="text-xs font-semibold text-gray-700">17/06/2026</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-200">
                ATTIVO
              </span>
            </div>

            {/* Add-on 2 */}
            <div className="bg-white rounded-2xl p-6 border border-gray-200 shadow-xs flex flex-wrap items-center justify-between gap-4">
              <div className="flex items-center gap-4">
                <div className="w-12 h-12 rounded-xl bg-blue-50 text-tw-blue flex items-center justify-center font-bold text-xl">
                  +
                </div>
                <div>
                  <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400">
                    SERVIZIO AGGIUNTIVO
                  </span>
                  <h4 className="text-sm font-bold text-gray-800">IT PRENOTAZIONI WEB</h4>
                </div>
              </div>
              <div className="text-center">
                <span className="text-[10px] uppercase font-bold tracking-wider text-gray-400 block">
                  ATTIVAZIONE
                </span>
                <span className="text-xs font-semibold text-gray-700">24/06/2026</span>
              </div>
              <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-700 font-bold text-[10px] uppercase border border-emerald-200">
                ATTIVO
              </span>
            </div>
          </div>
        )}

        {/* Tab 2: FATTURAZIONE */}
        {activeTab === 'fatturazione' && (
          <div className="space-y-6">
            {/* Top pending invoice banner */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col md:flex-row md:items-center justify-between">
              <div className="p-6 bg-red-50/70 border-b md:border-b-0 md:border-r border-red-100 flex flex-col justify-center min-w-48">
                <span className="text-[10px] font-bold text-red-500 uppercase tracking-wider">
                  ADDEBITI
                </span>
                <span className="text-2xl font-bold text-red-600">€ 456,78</span>
              </div>

              <div className="p-6 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  NUM. FATTURA
                </span>
                <span className="text-xs font-bold text-gray-800">IT100001015-5</span>
              </div>

              <div className="p-6 text-center">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider block">
                  SCADENZA DEL PAGAMENTO
                </span>
                <span className="text-xs font-bold text-gray-800">01 set 2026</span>
              </div>

              <div className="p-6 flex flex-wrap items-center justify-center gap-3">
                <button
                  onClick={() => alert('Download fattura')}
                  className="px-4 py-2 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold uppercase rounded-xl transition"
                >
                  SCARICA LA FATTURA
                </button>
                <button
                  onClick={() => alert('Paga ora')}
                  className="px-6 py-2 bg-tw-blue hover:bg-tw-blue-hover text-white text-xs font-bold uppercase rounded-xl shadow-xs transition"
                >
                  PAGA ORA
                </button>
              </div>
            </div>

            {/* Invoices Table */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <table className="w-full text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-4 px-6">DATA</th>
                    <th className="py-4 px-6">NUM. FATTURA</th>
                    <th className="py-4 px-6 text-right">FATTURA IN PDF</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {mockInvoices.slice(1).map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50 transition">
                      <td className="py-3.5 px-6 font-medium text-gray-700">{inv.date}</td>
                      <td className="py-3.5 px-6 font-semibold text-gray-800">{inv.number}</td>
                      <td className="py-3.5 px-6 text-right">
                        <button
                          onClick={() => alert(`Download PDF: ${inv.number}`)}
                          className="p-1 hover:text-tw-blue text-gray-400 transition"
                        >
                          <ArrowDownToLine className="w-4 h-4 ml-auto" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Tab 3: IMPOSTAZIONI */}
        {activeTab === 'impostazioni' && (
          <div className="space-y-6">
            {/* Shortname */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                LOGO E SHORTNAME DEL SALONE
              </div>
              <p className="text-xs text-gray-500 text-center">
                Carica il logo o un&apos;immagine del salone per aiutarti a distinguerlo rapidamente
                nella visualizzazione multisalone.
              </p>
              <div className="flex items-center justify-center gap-6 pt-2">
                <div className="w-16 h-16 rounded-xl bg-gray-100 border border-gray-200 flex items-center justify-center font-bold text-gray-500">
                  {shortname}
                </div>
                <div className="space-y-2">
                  <button className="px-4 py-1.5 bg-tw-blue text-white text-xs font-bold rounded-xl flex items-center gap-1">
                    <span>↑</span> CARICA IMMAGINE
                  </button>
                  <div className="flex items-center gap-2 text-xs">
                    <span className="text-gray-400">2. SHORTNAME</span>
                    <input
                      type="text"
                      value={shortname}
                      onChange={(e) => setShortname(e.target.value)}
                      className="w-16 text-center border border-gray-200 rounded-lg py-1 font-bold"
                    />
                  </div>
                </div>
              </div>
            </div>

            {/* Tipo di salone */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4 text-center">
              <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                TIPO DI SALONE
              </div>
              <div className="flex justify-center gap-8 pt-1">
                {['Unisex', 'Uomo', 'Donna'].map((type) => (
                  <label
                    key={type}
                    className="flex items-center gap-2 cursor-pointer text-xs font-semibold text-gray-700"
                  >
                    <input
                      type="radio"
                      name="salonType"
                      checked={salonType === type}
                      onChange={() => setSalonType(type)}
                      className="w-4 h-4 text-tw-blue"
                    />
                    <span>{type}</span>
                  </label>
                ))}
              </div>
            </div>

            {/* Promemoria */}
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                PROMEMORIA APPUNTAMENTO AL CLIENTE
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 sm:gap-4 text-xs font-medium text-gray-700">
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span>INVIA PUSH DI NOTIFICA</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-tw-blue rounded" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span>INVIA EMAIL DI NOTIFICA</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-tw-blue rounded" />
                </label>
                <label className="flex items-center justify-between p-3 bg-gray-50 rounded-xl">
                  <span>INVIA SMS DI NOTIFICA</span>
                  <input type="checkbox" defaultChecked className="w-5 h-5 text-tw-blue rounded" />
                </label>
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: VETRINA */}
        {activeTab === 'vetrina' && (
          <div className="space-y-6">
            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                LINK DI PRENOTAZIONE GRATUITA (APP)
              </div>
              <p className="text-xs text-gray-500 text-center max-w-md mx-auto">
                Copia questo link e condividilo sul tuo sito web, nei messaggi, nelle e-mail di
                marketing e nella firma e-mail per ricevere gratuitamente le prenotazioni.
              </p>
              <div className="flex items-center gap-2 max-w-md mx-auto pt-2">
                <input
                  type="text"
                  readOnly
                  value="https://trea.tw/PS7ey8EtPCehmq6Eq"
                  className="flex-1 bg-gray-50 border border-gray-200 rounded-full px-4 py-2 text-xs font-mono text-gray-700"
                />
                <button
                  onClick={handleCopy}
                  className="px-5 py-2 bg-tw-blue hover:bg-tw-blue-hover text-white text-xs font-bold uppercase rounded-full shadow-xs flex items-center gap-1.5 transition"
                >
                  {copiedLink ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                  <span>{copiedLink ? 'COPIATO' : 'COPIA'}</span>
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                CANALI SOCIAL
              </div>
              <div className="flex flex-wrap items-center justify-between gap-3 p-4 bg-gray-50 rounded-xl max-w-md mx-auto">
                <div className="flex items-center gap-3">
                  <FacebookIcon />
                  <InstagramIcon />
                  <MessageCircle className="w-5 h-5 text-purple-600" />
                  <span className="text-xs font-semibold text-gray-800">Collega profili social</span>
                </div>
                <button
                  onClick={() => alert('Connetti profili social')}
                  className="px-4 py-1.5 bg-tw-blue text-white font-bold text-xs rounded-xl"
                >
                  CONNETTI
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Tab 5: UTENTI */}
        {activeTab === 'utenti' && (
          <div className="space-y-4">
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="p-6 text-center border-b border-gray-100">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  UTENTI ATTIVI
                </span>
              </div>
              <div className="overflow-x-auto">
              <table className="w-full min-w-[720px] text-xs text-left">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    <th className="py-4 px-6">NOME</th>
                    <th className="py-4 px-6">EMAIL</th>
                    <th className="py-4 px-6">RUOLO</th>
                    <th className="py-4 px-6">CREATO IL</th>
                    <th className="py-4 px-6">STATO</th>
                    <th className="py-4 px-6 text-right">AZIONI</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                  <tr className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-bold text-gray-800">Andrea Qiu</td>
                    <td className="py-4 px-6">qiuandrea@hotmail.it</td>
                    <td className="py-4 px-6">Titolare</td>
                    <td className="py-4 px-6">05/08/2026</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                        CONFERMATO
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <Edit2 className="w-4 h-4 text-gray-400 inline hover:text-tw-blue cursor-pointer" />
                      <Trash2 className="w-4 h-4 text-gray-400 inline hover:text-red-500 cursor-pointer" />
                    </td>
                  </tr>
                  <tr className="hover:bg-gray-50">
                    <td className="py-4 px-6 font-bold text-gray-800">Gianluca Tadonio</td>
                    <td className="py-4 px-6">tadoniogianluca93@gmail.com</td>
                    <td className="py-4 px-6">Titolare</td>
                    <td className="py-4 px-6">17/06/2026</td>
                    <td className="py-4 px-6">
                      <span className="px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-800 text-[10px] font-bold uppercase">
                        CONFERMATO
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2">
                      <Edit2 className="w-4 h-4 text-gray-400 inline hover:text-tw-blue cursor-pointer" />
                      <Trash2 className="w-4 h-4 text-gray-400 inline hover:text-red-500 cursor-pointer" />
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>

              <div className="p-4 text-center border-t border-gray-100">
                <button
                  onClick={() => alert('Aggiungi utente')}
                  className="text-tw-blue font-bold text-xs uppercase tracking-wider hover:underline"
                >
                  AGGIUNGI UTENTE
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
