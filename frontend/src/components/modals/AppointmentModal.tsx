'use client';

import React, { useState, useEffect } from 'react';
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
} from 'lucide-react';
import { Appointment, ServiceItem, StaffMember } from '@/types';

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
  const [durationFormatted, setDurationFormatted] = useState('1.15h');
  const [notes, setNotes] = useState('');
  const [cleaningTime, setCleaningTime] = useState('0:00');

  useEffect(() => {
    if (appointment) {
      setClientName(appointment.clientName);
      setClientPhone(appointment.clientPhone || '');
      setClientEmail(appointment.clientEmail || '');
      setHasPrivacyConsent(appointment.hasPrivacyConsent);
      setServiceId(appointment.serviceId);
      setStaffId(appointment.staffId);
      setDurationFormatted(appointment.durationFormatted);
      setNotes(appointment.notes || '');
    } else {
      setClientName('Morena');
      setClientPhone('+39 347 1234567');
      setClientEmail('');
      setHasPrivacyConsent(false);
      setServiceId(services[0]?.id || '');
      setStaffId(staffList[0]?.id || '');
      setDurationFormatted('1.15h');
      setNotes('');
    }
  }, [appointment, services, staffList]);

  if (!isOpen) return null;

  const currentService = services.find((s) => s.id === serviceId) || services[0];
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
      serviceId: currentService?.id || 'srv-1',
      serviceName: currentService?.name || 'Acconciatura',
      serviceShortname: currentService?.shortname || 'A',
      serviceColor: currentService?.categoryColor || '#3584F6',
      staffId: currentStaff?.id || 'staff-1',
      staffInitials: currentStaff?.initials || 'GI',
      staffName: currentStaff?.name || 'Gianluca',
      date: appointment ? appointment.date : '2026-09-02',
      dayOfWeek: appointment ? appointment.dayOfWeek : 'MER 2',
      startTime: appointment ? appointment.startTime : '08:00',
      durationFormatted,
      durationMinutes: 75,
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/30 backdrop-blur-[1px]">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-150">
        {/* Top Title Bar */}
        <div className="px-5 py-3.5 border-b border-gray-100 flex items-center justify-between">
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 text-gray-500 rounded-lg transition"
          >
            <X className="w-5 h-5" />
          </button>
          <div className="text-xs font-bold text-gray-700 uppercase tracking-wide">
            {appointment ? `${appointment.dayOfWeek} - ${appointment.startTime}` : 'MER 2 - 08:00'}
          </div>
          <button
            onClick={handleSave}
            className="w-8 h-8 rounded-full bg-tw-blue hover:bg-tw-blue-hover text-white flex items-center justify-center shadow-md transition"
            title="Conferma Appuntamento"
          >
            <Check className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Form Body */}
        <div className="p-5 space-y-4 max-h-[80vh] overflow-y-auto">
          {/* Privacy Alert Pill */}
          {!hasPrivacyConsent && (
            <div className="flex justify-center">
              <span className="bg-red-500 text-white text-[10px] font-semibold px-3 py-0.5 rounded-full shadow-sm">
                Non ha dato i consensi per la privacy
              </span>
            </div>
          )}

          {/* Client Input with Info Icons */}
          <div className="space-y-2">
            <div className="relative flex items-center">
              <input
                type="text"
                value={clientName}
                onChange={(e) => setClientName(e.target.value)}
                placeholder="Nome cliente"
                className="w-full bg-white border border-gray-200 rounded-full px-4 py-2 text-xs font-semibold text-gray-800 focus:outline-none focus:ring-1 focus:ring-tw-blue pr-16"
              />
              <div className="absolute right-3 flex items-center gap-1.5 text-gray-400">
                <button
                  type="button"
                  onClick={() => alert(`Dettagli cliente: ${clientName}`)}
                  className="hover:text-tw-blue"
                  title="Scheda cliente"
                >
                  <Info className="w-4 h-4 text-tw-blue" />
                </button>
                <button
                  type="button"
                  className="relative hover:text-tw-blue"
                  title="Storico visite"
                >
                  <ListFilter className="w-4 h-4" />
                  <span className="absolute -top-1.5 -right-1.5 w-3.5 h-3.5 bg-red-500 text-white text-[8px] font-bold rounded-full flex items-center justify-center">
                    1
                  </span>
                </button>
              </div>
            </div>

            {/* Phone input */}
            <input
              type="text"
              value={clientPhone}
              onChange={(e) => setClientPhone(e.target.value)}
              placeholder="Telefono"
              className="w-full bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
            />

            {/* Email input with green tip */}
            <div>
              <div className="text-[9px] font-bold text-emerald-600 uppercase tracking-wider pl-4 mb-0.5">
                COMPILA QUI PER RACCOGLIERE PIÙ RECENSIONI!
              </div>
              <input
                type="email"
                value={clientEmail}
                onChange={(e) => setClientEmail(e.target.value)}
                placeholder="Email"
                className="w-full bg-white border border-gray-200 rounded-full px-4 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
            </div>

            {/* Quick reaction icons row */}
            <div className="flex items-center justify-center gap-5 pt-1 text-gray-400">
              <button className="hover:text-red-500 transition" title="Cliente preferito">
                <Heart className="w-4 h-4" />
              </button>
              <button className="hover:text-amber-500 transition" title="Soddisfazione">
                <Smile className="w-4 h-4" />
              </button>
              <button className="hover:text-blue-500 transition" title="Puntualità">
                <Clock className="w-4 h-4" />
              </button>
              <span className="text-gray-300">•</span>
              <button className="hover:text-pink-500 transition" title="Compleanno">
                <Cake className="w-4 h-4" />
              </button>
              <button className="hover:text-indigo-500 transition" title="Note tecniche">
                <FileText className="w-4 h-4" />
              </button>
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Service Section Card */}
          <div className="border border-gray-200 rounded-xl p-3.5 space-y-3 bg-white shadow-xs">
            <div className="text-[11px] font-mono text-gray-400">08:00</div>

            {/* Service & Duration Row */}
            <div className="flex items-center justify-between border-b border-gray-100 pb-2">
              <select
                value={serviceId}
                onChange={(e) => setServiceId(e.target.value)}
                className="font-bold text-xs text-gray-800 bg-transparent border-none focus:outline-none cursor-pointer flex-1"
              >
                {services.map((srv) => (
                  <option key={srv.id} value={srv.id}>
                    {srv.name}
                  </option>
                ))}
              </select>
              <div className="flex items-center gap-1.5">
                <select
                  value={durationFormatted}
                  onChange={(e) => setDurationFormatted(e.target.value)}
                  className="text-xs text-gray-600 bg-gray-50 border border-gray-200 rounded-md px-2 py-0.5"
                >
                  <option value="0.15h">0.15h</option>
                  <option value="0.30h">0.30h</option>
                  <option value="1.00h">1.00h</option>
                  <option value="1.15h">1.15h</option>
                  <option value="1.45h">1.45h</option>
                  <option value="2.45h">2.45h</option>
                </select>
                <span
                  className="w-5 h-5 rounded-full text-[9px] font-bold text-white flex items-center justify-center shadow-xs"
                  style={{ backgroundColor: currentService?.categoryColor || '#DC2626' }}
                >
                  {currentService?.shortname || 'CR'}
                </span>
              </div>
            </div>

            {/* CON: Staff Picker */}
            <div className="flex items-center justify-between text-xs text-gray-600">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                CON
              </span>
              <div className="flex items-center gap-2">
                <select
                  value={staffId}
                  onChange={(e) => setStaffId(e.target.value)}
                  className="border border-gray-200 rounded-md px-2.5 py-1 text-xs font-medium text-gray-800 bg-white"
                >
                  {staffList.map((st) => (
                    <option key={st.id} value={st.id}>
                      {st.name}
                    </option>
                  ))}
                </select>
                <Armchair className="w-4 h-4 text-gray-400" />
              </div>
            </div>

            {/* NOTE Input */}
            <div className="space-y-1">
              <span className="text-[10px] font-bold uppercase tracking-wider text-gray-400">
                NOTE
              </span>
              <textarea
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                placeholder="Inserisci qui le note tecniche.."
                rows={2}
                className="w-full text-xs p-2 border border-gray-200 rounded-lg text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              />
            </div>

            {/* Stats Row */}
            <div className="flex items-center justify-between text-[10px] text-gray-500 font-medium pt-1">
              <span>FEE 0%</span>
              <span>FONTE DIRECT</span>
            </div>
          </div>

          {/* Buffer Pulizia Row */}
          <div className="flex items-center justify-between p-2.5 bg-gray-50 rounded-xl text-xs text-gray-700">
            <span className="flex items-center gap-2">
              <span>🧽</span>
              <span>Tempo di pulizia</span>
            </span>
            <select
              value={cleaningTime}
              onChange={(e) => setCleaningTime(e.target.value)}
              className="border border-gray-200 rounded-md px-2 py-0.5 text-xs bg-white"
            >
              <option value="0:00">0:00</option>
              <option value="0:05">0:05</option>
              <option value="0:10">0:10</option>
              <option value="0:15">0:15</option>
            </select>
          </div>

          {/* Bottom Action Buttons Bar */}
          <div className="flex items-center justify-between pt-2 border-t border-gray-100">
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => {
                  if (appointment && confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
                    onDelete(appointment.id);
                    onClose();
                  }
                }}
                className="p-2 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-lg transition"
                title="Elimina"
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
                className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
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
                className="px-2.5 py-1 text-xs font-medium text-gray-600 hover:bg-gray-100 rounded-lg transition"
                title="Imposta appuntamento ricorrente"
              >
                Ripeti
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="p-2 hover:bg-gray-100 text-gray-500 rounded-lg transition"
                title="Stampa promemoria o scheda lavoro"
              >
                <Printer className="w-4 h-4" />
              </button>
            </div>

            {/* Send to Cassa Button */}
            <button
              type="button"
              onClick={handleSendToCassaClick}
              className="w-10 h-10 rounded-xl bg-tw-blue-pill hover:bg-tw-blue text-tw-blue hover:text-white flex items-center justify-center transition shadow-xs"
              title="Salva e passa alla cassa (accogli o incassa cliente)"
            >
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
