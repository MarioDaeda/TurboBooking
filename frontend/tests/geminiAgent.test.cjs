const test = require('node:test');
const assert = require('node:assert/strict');
const { load } = require('./load-ts.cjs');

const mockCustomerId = '10000000-0000-4000-8000-000000000001';
const mockServiceId = '20000000-0000-4000-8000-000000000001';
const mockStaffId = '30000000-0000-4000-8000-000000000001';
const mockAppId = '40000000-0000-4000-8000-000000000001';

function loadAgent(overrides = {}) {
  return load('src/server/domain/conversational/geminiBookingAgent.ts', {
    '../booking/availabilityService': {
      AvailabilityService: {
        findAvailableSlots: async () => [
          {
            startsAt: '2026-09-15T07:00:00.000Z', // 09:00 CEST
            endsAt: '2026-09-15T07:45:00.000Z',   // 09:45 CEST
            staffId: mockStaffId,
            staffName: 'Gianluca Tadonio',
            serviceId: mockServiceId,
            serviceName: 'Taglio Uomo',
            priceCents: 3000,
          },
          {
            startsAt: '2026-01-15T08:00:00.000Z', // 09:00 CET
            endsAt: '2026-01-15T08:30:00.000Z',   // 09:30 CET
            staffId: mockStaffId,
            staffName: 'Gianluca Tadonio',
            serviceId: mockServiceId,
            serviceName: 'Barba',
            priceCents: 1500,
          }
        ],
        reserveHold: async (args) => ({ success: true, hold: { id: mockAppId, ...args } }),
        confirmHold: async (id) => ({ success: true, appointment: { id, status: 'confirmed' } }),
        cancelAppointment: async (id) => ({ success: true, appointment: { id, status: 'cancelled' } }),
        rescheduleAppointment: async (args) => ({ success: true, appointment: { id: args.appointmentId, ...args } }),
      },
    },
    '../../db/repositories': {
      ServiceRepository: { searchBookableOnline: async () => [] },
      AppointmentRepository: {
        findHold: async (id) => ({
          id,
          customer_id: mockCustomerId,
          start_at: '2026-09-15T07:00:00.000Z',
          end_at: '2026-09-15T07:45:00.000Z',
        }),
      },
    },
    '../../integrations/gemini/geminiClient': {
      GeminiClient: { generate: async () => ({}) },
    },
    ...overrides,
  });
}

test('buildSystemInstruction uses Europe/Rome today date and warns about Rome local time', () => {
  const { buildSystemInstruction, getRomeTodayDate } = loadAgent();
  const instruction = buildSystemInstruction('Mario');
  const todayRome = getRomeTodayDate();
  assert.ok(instruction.includes(todayRome), 'Attesa data odierna di Roma');
  assert.ok(instruction.includes('Europe/Rome'), 'Atteso riferimento a Europe/Rome');
  assert.ok(instruction.includes('ora locale italiana'), 'Attesa esplicitazione ora locale italiana');
  assert.ok(instruction.includes('Mario'), 'Atteso nome cliente');
});

test('controlla_disponibilita enriches UTC slots with Europe/Rome local time (hour and date)', async () => {
  const { runTool } = loadAgent();
  const result = await runTool('controlla_disponibilita', { data: '2026-09-15', servizio_id: mockServiceId }, mockCustomerId);
  assert.equal(result.fuso_orario, 'Europe/Rome');
  assert.equal(result.totale_slot, 2);

  const slotSummer = result.slots[0];
  // 07:00 UTC a settembre deve essere 09:00 ora locale di Roma
  assert.equal(slotSummer.ora_locale_inizio, '09:00');
  assert.equal(slotSummer.ora_locale_fine, '09:45');
  assert.equal(slotSummer.data_locale, '2026-09-15');

  const slotWinter = result.slots[1];
  // 08:00 UTC a gennaio deve essere 09:00 ora locale di Roma (solare UTC+1)
  assert.equal(slotWinter.ora_locale_inizio, '09:00');
  assert.equal(slotWinter.ora_locale_fine, '09:30');
  assert.equal(slotWinter.data_locale, '2026-01-15');
});

test('availability refuses a missing service and catalog search exposes only explicit matches', async () => {
  let availabilityCalled = false;
  const { runTool } = loadAgent({
    '../booking/availabilityService': { AvailabilityService: { findAvailableSlots: async () => { availabilityCalled = true; return []; } } },
    '../../db/repositories': {
      AppointmentRepository: {},
      ServiceRepository: { searchBookableOnline: async () => [{
        id: mockServiceId, name: 'Taglio Uomo', description: null, category: 'Taglio', duration_minutes: 30, price: 30,
      }] },
    },
  });
  const missing = await runTool('controlla_disponibilita', { data: '2026-09-15' }, mockCustomerId);
  assert.equal(missing.success, false);
  assert.equal(availabilityCalled, false);
  const catalog = await runTool('cerca_servizi', { query: 'taglio uomo' }, mockCustomerId);
  assert.equal(catalog.totale, 1);
  assert.equal(catalog.servizi[0].servizio_id, mockServiceId);
});

test('crea_evento converts customer Rome local time to UTC using romeLocalToUtc', async () => {
  let reservedStartsAt = null;
  const { runTool } = loadAgent({
    '../booking/availabilityService': {
      AvailabilityService: {
        reserveHold: async (args) => {
          reservedStartsAt = args.startsAt;
          return { success: true, hold: { id: mockAppId, ...args } };
        },
        confirmHold: async (id) => ({ success: true, appointment: { id, status: 'confirmed' } }),
      },
    },
  });

  // A settembre (CEST, UTC+2): 09:00 locale deve diventare 07:00 UTC
  const resSummer = await runTool('crea_evento', {
    servizio_id: mockServiceId,
    staff_id: mockStaffId,
    data: '2026-09-15',
    ora_inizio: '09:00',
  }, mockCustomerId);

  assert.equal(resSummer.success, true);
  assert.equal(reservedStartsAt, '2026-09-15T07:00:00.000Z', '09:00 CEST deve essere 07:00 UTC');

  // A gennaio (CET, UTC+1): 09:00 locale deve diventare 08:00 UTC
  const resWinter = await runTool('crea_evento', {
    servizio_id: mockServiceId,
    staff_id: mockStaffId,
    data: '2026-01-15',
    ora_inizio: '09:00',
  }, mockCustomerId);

  assert.equal(resWinter.success, true);
  assert.equal(reservedStartsAt, '2026-01-15T08:00:00.000Z', '09:00 CET deve essere 08:00 UTC');
});

test('modifica_prenotazione converts new local start time to UTC preserving appointment duration', async () => {
  let rescheduledArgs = null;
  const { runTool } = loadAgent({
    '../booking/availabilityService': {
      AvailabilityService: {
        rescheduleAppointment: async (args) => {
          rescheduledArgs = args;
          return { success: true, appointment: { id: args.appointmentId, ...args } };
        },
      },
    },
    '../../db/repositories': {
      AppointmentRepository: {
        findHold: async (id) => ({
          id,
          customer_id: mockCustomerId,
          start_at: '2026-09-15T07:00:00.000Z',
          end_at: '2026-09-15T07:45:00.000Z', // 45 minuti
        }),
      },
    },
  });

  // Spostamento alle 15:00 CEST -> deve diventare 13:00 UTC con fine alle 13:45 UTC
  const res = await runTool('modifica_prenotazione', {
    appointment_id: mockAppId,
    nuova_data: '2026-09-15',
    nuova_ora_inizio: '15:00',
  }, mockCustomerId);

  assert.equal(res.success, true);
  assert.equal(rescheduledArgs.startsAt, '2026-09-15T13:00:00.000Z');
  assert.equal(rescheduledArgs.endsAt, '2026-09-15T13:45:00.000Z');
});
