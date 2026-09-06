'use client';

import React, { useState, useEffect } from 'react';
import {
  Megaphone,
  Search,
  Bot,
  Database,
  Share2,
  CheckCircle2,
  Send,
  RefreshCw,
  Sparkles,
  ShieldCheck,
} from 'lucide-react';

interface ChatMessage {
  id: string;
  sender: 'user' | 'agent';
  text: string;
  channel: string;
  timestamp: string;
  meta?: {
    intent?: string;
    holdId?: string;
    escalatedToHuman?: boolean;
    customerName?: string;
  };
}

interface IntegrationStatusResponse {
  status: string;
  timestamp: string;
  providers: {
    supabase: { connected: boolean; mode: string; details: string };
    ghl: { configured: boolean; webhookUrl: string; features: string[] };
    meta: { configured: boolean; webhookUrl: string; features: string[] };
  };
  metrics: {
    totalRecentWebhooks: number;
    totalRecentNotifications: number;
  };
}

export const ComunicazioniView: React.FC = () => {
  const [activeTab, setActiveTab] = useState<'campaigns' | 'integrations'>('integrations');

  // Simulator state
  const [simChannel, setSimChannel] = useState<'whatsapp' | 'instagram' | 'messenger' | 'ghl'>('whatsapp');
  const [userPhone, setUserPhone] = useState('+393401234567');
  const [userName, setUserName] = useState('Chiara Ferrandi');
  const [inputMsg, setInputMsg] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'm-0',
      sender: 'agent',
      text: 'Ciao Chiara! Sono il receptionist AI di TurboBooking collegato con Meta (WhatsApp/IG) e GoHighLevel. Come posso aiutarti oggi?',
      channel: 'whatsapp',
      timestamp: 'Adesso',
      meta: { intent: 'greeting', customerName: 'Chiara' },
    },
  ]);

  // Integrations status state
  const [statusData, setStatusData] = useState<IntegrationStatusResponse | null>(null);
  const [loadingStatus, setLoadingStatus] = useState(false);

  const fetchStatus = async () => {
    setLoadingStatus(true);
    try {
      const res = await fetch('/api/v1/integrations/status');
      if (res.ok) {
        const data: IntegrationStatusResponse = await res.json();
        setStatusData(data);
      }
    } catch {
      // Ignora errori se server offline
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSendMessage = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!inputMsg.trim() || isLoading) return;

    const currentText = inputMsg.trim();
    setInputMsg('');

    const newMsg: ChatMessage = {
      id: `usr_${Date.now()}`,
      sender: 'user',
      text: currentText,
      channel: simChannel,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages((prev) => [...prev, newMsg]);
    setIsLoading(true);

    try {
      const res = await fetch('/api/v1/conversational/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          message: currentText,
          channel: simChannel === 'ghl' ? 'whatsapp' : simChannel,
          provider: simChannel === 'ghl' ? 'ghl' : 'meta',
          phone: userPhone,
          senderName: userName,
        }),
      });

      if (res.ok) {
        const data = await res.json();
        const result = data.result;

        setMessages((prev) => [
          ...prev,
          {
            id: `agt_${Date.now()}`,
            sender: 'agent',
            text: result.replyText,
            channel: simChannel,
            timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
            meta: {
              intent: result.intent,
              holdId: result.holdId,
              escalatedToHuman: result.escalatedToHuman,
              customerName: result.customer?.first_name,
            },
          },
        ]);
      } else {
        setMessages((prev) => [
          ...prev,
          {
            id: `err_${Date.now()}`,
            sender: 'agent',
            text: 'Errore temporaneo di risposta del server backend.',
            channel: simChannel,
            timestamp: 'Adesso',
          },
        ]);
      }
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: `err_${Date.now()}`,
          sender: 'agent',
          text: 'Connessione al backend non riuscita.',
          channel: simChannel,
          timestamp: 'Adesso',
        },
      ]);
    } finally {
      setIsLoading(false);
      fetchStatus();
    }
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto select-none p-8">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {/* Navigation Tabs */}
        <div className="flex items-center justify-between border-b border-gray-200 pb-3">
          <div className="flex items-center gap-4">
            <button
              onClick={() => setActiveTab('integrations')}
              className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold tracking-wide transition border-b-2 ${
                activeTab === 'integrations'
                  ? 'border-tw-blue text-tw-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Bot className="w-4 h-4" />
              Integrazioni & Accoglienza Meta AI
            </button>
            <button
              onClick={() => setActiveTab('campaigns')}
              className={`flex items-center gap-2 pb-2 px-1 text-sm font-bold tracking-wide transition border-b-2 ${
                activeTab === 'campaigns'
                  ? 'border-tw-blue text-tw-blue'
                  : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              <Megaphone className="w-4 h-4" />
              Campagne & Notifiche
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={fetchStatus}
              disabled={loadingStatus}
              className="flex items-center gap-1.5 px-3 py-1 bg-white border border-gray-200 rounded-full text-xs font-semibold text-gray-700 hover:bg-gray-50 shadow-xs"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingStatus ? 'animate-spin text-tw-blue' : 'text-gray-500'}`} />
              Aggiorna Stato
            </button>
          </div>
        </div>

        {activeTab === 'integrations' ? (
          <div className="space-y-6">
            {/* Status Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Supabase Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-emerald-50 text-emerald-600">
                        <Database className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-gray-800">Supabase</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-emerald-50 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 className="w-3 h-3" /> {statusData?.providers.supabase.connected ? 'Attivo' : 'Pronto'}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    PostgreSQL 16 con RLS, schema multi-tenant e audit dei log di sicurezza GDPR.
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Persistenza Webhook</span>
                  <span className="font-mono text-gray-600 font-semibold">inbound_webhooks</span>
                </div>
              </div>

              {/* GoHighLevel Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-blue-50 text-tw-blue">
                        <Share2 className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-gray-800">GoHighLevel</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-blue-50 text-tw-blue border border-blue-200">
                      <CheckCircle2 className="w-3 h-3" /> Anti-Corruption
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    System of Engagement: Conversations multicanale e sync contatti con allowlist Art. 9.
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Webhook Endpoint</span>
                  <span className="font-mono text-gray-600 font-semibold">/api/webhooks/ghl</span>
                </div>
              </div>

              {/* Meta AI Status */}
              <div className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs flex flex-col justify-between">
                <div>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <div className="p-2 rounded-xl bg-purple-50 text-purple-600">
                        <Bot className="w-5 h-5" />
                      </div>
                      <span className="font-bold text-sm text-gray-800">Meta AI & Webhook</span>
                    </div>
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase bg-purple-50 text-purple-700 border border-purple-200">
                      <Sparkles className="w-3 h-3" /> Single Brain
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-2">
                    Accoglienza WhatsApp Cloud, Instagram Direct, Messenger e Leadgen con verifica HMAC.
                  </p>
                </div>
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between text-[11px] text-gray-400">
                  <span>Webhook Endpoint</span>
                  <span className="font-mono text-gray-600 font-semibold">/api/webhooks/meta</span>
                </div>
              </div>
            </div>

            {/* Architecture Banner */}
            <div className="bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-2xl p-5 shadow-md flex items-center justify-between">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <ShieldCheck className="w-5 h-5 text-emerald-400" />
                  <h3 className="font-bold text-sm">Architettura Unica di Dominio (&quot;Una Sola Logica&quot;)</h3>
                </div>
                <p className="text-xs text-blue-200 max-w-2xl">
                  Tutta la logica di calcolo slot, hold transazionali a 7 minuti, verifica dei consensi e risposte parlate risiede rigorosamente nel backend di TurboBooking. Sia i canali Meta diretti che GoHighLevel o il receptionist telefonico BetterCallQ convergono sul medesimo motore centralizzato.
                </p>
              </div>
              <div className="hidden lg:flex items-center gap-3">
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
                  Postgres + RLS
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
                  HMAC SHA-256
                </span>
                <span className="text-[10px] uppercase font-bold tracking-wider px-3 py-1.5 bg-white/10 rounded-full border border-white/20">
                  GDPR Art. 9 Safe
                </span>
              </div>
            </div>

            {/* Interactive Live Simulator */}
            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden flex flex-col">
              <div className="px-6 py-4 border-b border-gray-100 flex flex-wrap items-center justify-between gap-3 bg-gray-50/50">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-emerald-500 animate-pulse" />
                  <span className="font-bold text-xs uppercase tracking-wider text-gray-700">
                    Simulatore Live Receptionist AI (Meta / GHL / WhatsApp)
                  </span>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium">Cliente:</span>
                    <input
                      type="text"
                      value={userName}
                      onChange={(e) => setUserName(e.target.value)}
                      className="border border-gray-200 bg-white rounded-lg px-2 py-1 text-xs w-32 font-semibold text-gray-700"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium">Telefono:</span>
                    <input
                      type="text"
                      value={userPhone}
                      onChange={(e) => setUserPhone(e.target.value)}
                      className="border border-gray-200 bg-white rounded-lg px-2 py-1 text-xs w-32 font-mono text-gray-700"
                    />
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-gray-500 font-medium">Canale:</span>
                    <select
                      value={simChannel}
                      onChange={(e) =>
                        setSimChannel(e.target.value as 'whatsapp' | 'instagram' | 'messenger' | 'ghl')
                      }
                      className="border border-gray-200 bg-white rounded-lg px-2.5 py-1 text-xs font-semibold text-gray-700 focus:ring-1 focus:ring-tw-blue"
                    >
                      <option value="whatsapp">WhatsApp Cloud API (Meta)</option>
                      <option value="instagram">Instagram Direct (Meta)</option>
                      <option value="messenger">Facebook Messenger (Meta)</option>
                      <option value="ghl">GoHighLevel Inbound Message</option>
                    </select>
                  </div>
                </div>
              </div>

              {/* Chat Thread */}
              <div className="p-6 h-80 overflow-y-auto space-y-4 bg-gray-50/30">
                {messages.map((m) => (
                  <div
                    key={m.id}
                    className={`flex flex-col ${m.sender === 'user' ? 'items-end' : 'items-start'}`}
                  >
                    <div
                      className={`max-w-lg rounded-2xl p-4 text-xs shadow-xs ${
                        m.sender === 'user'
                          ? 'bg-tw-blue text-white rounded-br-none'
                          : 'bg-white border border-gray-200 text-gray-800 rounded-bl-none'
                      }`}
                    >
                      <div className="flex items-center justify-between gap-3 mb-1 opacity-75 text-[10px]">
                        <span className="font-semibold">{m.sender === 'user' ? userName : 'TurboBooking AI'}</span>
                        <span>{m.timestamp}</span>
                      </div>
                      <p className="leading-relaxed text-sm whitespace-pre-line">{m.text}</p>
                    </div>

                    {/* Metadata Pill */}
                    {m.meta && (
                      <div className="mt-1 flex items-center gap-1.5 text-[10px] text-gray-400">
                        {m.meta.intent && (
                          <span className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded-full font-mono">
                            intent: {m.meta.intent}
                          </span>
                        )}
                        {m.meta.holdId && (
                          <span className="px-2 py-0.5 bg-blue-50 text-tw-blue rounded-full font-mono">
                            hold attivo: {m.meta.holdId.slice(0, 8)}...
                          </span>
                        )}
                        {m.meta.escalatedToHuman && (
                          <span className="px-2 py-0.5 bg-amber-50 text-amber-700 rounded-full font-semibold">
                            escalation operatore
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {isLoading && (
                  <div className="flex items-center gap-2 text-xs text-gray-400 italic">
                    <Sparkles className="w-3.5 h-3.5 text-tw-blue animate-spin" />
                    Il motore AI sta analizzando disponibilità e vincoli...
                  </div>
                )}
              </div>

              {/* Message Input & Quick Action Chips */}
              <div className="p-4 border-t border-gray-100 bg-white space-y-3">
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  <span className="text-[10px] font-bold text-gray-400 uppercase">Prompt di prova:</span>
                  <button
                    onClick={() => setInputMsg('Avete posto per un taglio domani?')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition text-[11px]"
                  >
                    &quot;Avete posto per un taglio domani?&quot;
                  </button>
                  <button
                    onClick={() => setInputMsg('Vorrei prenotare con Gianluca alle 10:00')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition text-[11px]"
                  >
                    &quot;Vorrei prenotare con Gianluca alle 10:00&quot;
                  </button>
                  <button
                    onClick={() => setInputMsg('Sì, confermo!')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition text-[11px]"
                  >
                    &quot;Sì, confermo!&quot;
                  </button>
                  <button
                    onClick={() => setInputMsg('Vorrei parlare con un operatore')}
                    className="px-2.5 py-1 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full transition text-[11px]"
                  >
                    &quot;Vorrei parlare con un operatore&quot;
                  </button>
                </div>

                <form onSubmit={handleSendMessage} className="flex items-center gap-3">
                  <input
                    type="text"
                    value={inputMsg}
                    onChange={(e) => setInputMsg(e.target.value)}
                    placeholder="Scrivi un messaggio come farebbe un cliente su WhatsApp o Instagram..."
                    className="flex-1 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-xs text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue transition"
                  />
                  <button
                    type="submit"
                    disabled={isLoading || !inputMsg.trim()}
                    className="flex items-center gap-1.5 px-5 py-2.5 bg-tw-blue hover:bg-tw-blue-hover disabled:opacity-50 text-white rounded-xl text-xs font-bold shadow-xs transition"
                  >
                    <Send className="w-3.5 h-3.5" />
                    Invia
                  </button>
                </form>
              </div>
            </div>
          </div>
        ) : (
          /* Standard Campaigns View */
          <div className="space-y-6">
            <div className="flex items-center justify-between gap-4">
              <div className="flex items-center gap-2">
                <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  PERIODO
                </span>
                <select className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs focus:ring-1 focus:ring-tw-blue">
                  <option>DA 06/09/2025 A 06/09/2026</option>
                </select>
              </div>

              <div className="flex items-center gap-3">
                <div className="relative w-64">
                  <input
                    type="text"
                    placeholder="Cerca"
                    className="w-full bg-white border border-gray-200 rounded-full pl-4 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue shadow-xs"
                  />
                  <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
                </div>

                <button
                  onClick={() => alert('Crea nuova comunicazione')}
                  className="px-4 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold uppercase tracking-wider rounded-full shadow-xs transition"
                >
                  + CREA NUOVA COMUNICAZIONE
                </button>
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
              <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between text-xs font-semibold">
                <span className="text-gray-400 uppercase tracking-wider text-[10px]">
                  COMUNICAZIONI VIA GOHIGHLEVEL
                </span>
                <span className="text-gray-500 font-normal">
                  Notifiche transazionali e campagne gestite tramite adapter GHL Conversations.{' '}
                  <button
                    onClick={() => setActiveTab('integrations')}
                    className="text-tw-blue font-bold uppercase tracking-wide hover:underline ml-1"
                  >
                    VEDI INTEGRAZIONI
                  </button>
                </span>
              </div>

              <div className="py-24 flex flex-col items-center justify-center text-center space-y-4">
                <div className="w-20 h-20 rounded-2xl border-2 border-dashed border-gray-200 flex items-center justify-center text-gray-300">
                  <Megaphone className="w-10 h-10" />
                </div>
                <div className="text-xs text-gray-400">Nessuna campagna manuale inviata nel periodo</div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
