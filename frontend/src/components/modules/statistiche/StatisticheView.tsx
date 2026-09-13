'use client';

import React, { useMemo, useState } from 'react';
import { Info } from 'lucide-react';
import type { Appointment, ServiceItem } from '@/types';

interface StatisticheViewProps {
  subSection:
    | 'andamento'
    | 'azienda'
    | 'corrispettivi'
    | 'collaboratori'
    | 'clienti'
    | 'magazzino'
    | 'inventario';
  appointments: Appointment[];
  services: ServiceItem[];
}

type PeriodKey = 'settimana' | 'mese' | '30giorni' | 'tutto';

const PERIODS: { key: PeriodKey; label: string }[] = [
  { key: 'settimana', label: 'Settimana corrente' },
  { key: 'mese', label: 'Mese corrente' },
  { key: '30giorni', label: 'Ultimi 30 giorni' },
  { key: 'tutto', label: 'Tutto' },
];

const VAT = 1.22;
const DAY_MS = 86_400_000;

const toIso = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const fmtEuro = (n: number) =>
  `€ ${n.toLocaleString('it-IT', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
const fmtDay = (iso: string) => iso.split('-').reverse().join('/');

// Restituisce [inizio, fine) del periodo scelto e del periodo di confronto precedente.
function periodRange(key: PeriodKey, today: Date): { from: string; to: string; prevFrom: string } | null {
  if (key === 'tutto') return null;
  let from: Date;
  let to: Date;
  if (key === 'settimana') {
    from = addDays(today, -((today.getDay() + 6) % 7));
    to = addDays(from, 7);
  } else if (key === 'mese') {
    from = new Date(today.getFullYear(), today.getMonth(), 1);
    to = new Date(today.getFullYear(), today.getMonth() + 1, 1);
  } else {
    to = addDays(today, 1);
    from = addDays(to, -30);
  }
  const lengthDays = Math.round((to.getTime() - from.getTime()) / DAY_MS);
  return { from: toIso(from), to: toIso(to), prevFrom: toIso(addDays(from, -lengthDays)) };
}

function summarize(apps: Appointment[], priceOf: (a: Appointment) => number) {
  const revenue = apps.reduce((sum, a) => sum + priceOf(a), 0);
  const presenze = new Set(apps.map((a) => `${a.clientId}|${a.date}`)).size;
  return {
    revenue,
    presenze,
    servizi: apps.length,
    ficheMedia: presenze ? revenue / presenze : 0,
    serviziPerFiche: presenze ? apps.length / presenze : 0,
  };
}

// Divide gli appuntamenti in n fasce temporali per i mini-grafici.
function buckets(apps: Appointment[], from: string, to: string, n: number, value: (a: Appointment) => number) {
  const start = Date.parse(from);
  const span = Math.max(Date.parse(to) - start, DAY_MS);
  const out = new Array(n).fill(0);
  for (const a of apps) {
    const i = Math.min(n - 1, Math.max(0, Math.floor(((Date.parse(a.date) - start) / span) * n)));
    out[i] += value(a);
  }
  return out;
}

const Sparkline: React.FC<{ values: number[] }> = ({ values }) => {
  const max = Math.max(...values, 1);
  const step = values.length > 1 ? 100 / (values.length - 1) : 100;
  const points = values.map((v, i) => `${(i * step).toFixed(1)},${(22 - (v / max) * 20).toFixed(1)}`).join(' ');
  return (
    <svg className="w-full h-6" fill="none" viewBox="0 0 100 24" preserveAspectRatio="none">
      <polyline points={points} stroke="#3584F6" strokeWidth="2" fill="none" vectorEffect="non-scaling-stroke" />
    </svg>
  );
};

const BarChart: React.FC<{ current: number[]; previous: number[]; color: string; format: (n: number) => string }> = ({
  current,
  previous,
  color,
  format,
}) => {
  const max = Math.max(...current, ...previous, 1);
  return (
    <div className="h-44 border-b border-l border-gray-200 flex items-end justify-around p-2 gap-2">
      {current.map((v, i) => (
        <div key={i} className="flex items-end gap-1 h-full" title={`${format(v)} (confronto: ${format(previous[i] ?? 0)})`}>
          <div className="w-5 rounded-t" style={{ height: `${(v / max) * 100}%`, backgroundColor: color }} />
          <div className="w-5 rounded-t bg-amber-400" style={{ height: `${((previous[i] ?? 0) / max) * 100}%` }} />
        </div>
      ))}
    </div>
  );
};

export const StatisticheView: React.FC<StatisticheViewProps> = ({ subSection, appointments, services }) => {
  const [period, setPeriod] = useState<PeriodKey>('settimana');
  const [sector, setSector] = useState('Tutti');

  const serviceById = useMemo(() => new Map(services.map((s) => [s.id, s])), [services]);
  const sectors = useMemo(() => ['Tutti', ...Array.from(new Set(services.map((s) => s.category))).sort()], [services]);
  const priceOf = (a: Appointment) => serviceById.get(a.serviceId)?.price ?? 0;

  const range = useMemo(() => periodRange(period, new Date()), [period]);

  const { current, previous, from, to } = useMemo(() => {
    const valid = appointments.filter(
      (a) => a.status !== 'cancelled' && (sector === 'Tutti' || serviceById.get(a.serviceId)?.category === sector),
    );
    if (!range) {
      const dates = valid.map((a) => a.date).sort();
      const first = dates[0] ?? toIso(new Date());
      const last = dates[dates.length - 1] ?? first;
      return { current: valid, previous: [] as Appointment[], from: first, to: toIso(addDays(new Date(last), 1)) };
    }
    return {
      current: valid.filter((a) => a.date >= range.from && a.date < range.to),
      previous: valid.filter((a) => a.date >= range.prevFrom && a.date < range.from),
      from: range.from,
      to: range.to,
    };
  }, [appointments, sector, serviceById, range]);

  const stats = summarize(current, priceOf);
  const prevFrom = range?.prevFrom ?? from;

  const filterBar = (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">PERIODO</span>
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value as PeriodKey)}
          className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs"
        >
          {PERIODS.map((p) => (
            <option key={p.key} value={p.key}>
              {p.label}
            </option>
          ))}
        </select>
        <span className="text-[10px] text-gray-400">
          {fmtDay(from)} – {fmtDay(toIso(addDays(new Date(to), -1)))}
        </span>
      </div>
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">SETTORE</span>
        <select
          value={sector}
          onChange={(e) => setSector(e.target.value)}
          className="border border-gray-200 bg-white rounded-xl px-3 py-1.5 text-xs font-semibold text-gray-700 shadow-xs"
        >
          {sectors.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
    </div>
  );

  if (subSection === 'corrispettivi') {
    const byDay = new Map<string, Appointment[]>();
    for (const a of current) byDay.set(a.date, [...(byDay.get(a.date) ?? []), a]);
    const rows = Array.from(byDay.entries())
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([date, apps]) => {
        const lordo = apps.reduce((s, a) => s + priceOf(a), 0);
        return { gg: fmtDay(date), lordo, ricevute: new Set(apps.map((a) => a.clientId)).size };
      });
    const total = rows.reduce(
      (t, r) => ({ lordo: t.lordo + r.lordo, ricevute: t.ricevute + r.ricevute }),
      { lordo: 0, ricevute: 0 },
    );

    const exportCsv = () => {
      const lines = [
        'Giorno;Imp. lordo;Imp. netto;Imp. servizi;Num. ricevute',
        ...rows.map((r) => `${r.gg};${r.lordo.toFixed(2)};${(r.lordo / VAT).toFixed(2)};${r.lordo.toFixed(2)};${r.ricevute}`),
        `Totale;${total.lordo.toFixed(2)};${(total.lordo / VAT).toFixed(2)};${total.lordo.toFixed(2)};${total.ricevute}`,
      ];
      const url = URL.createObjectURL(new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' }));
      const link = document.createElement('a');
      link.href = url;
      link.download = `corrispettivi_${from}.csv`;
      link.click();
      URL.revokeObjectURL(url);
    };

    const cells = (lordo: number, ricevute: number) => (
      <>
        <td className="py-3.5 px-4 text-right">€ {lordo.toFixed(2)}</td>
        <td className="py-3.5 px-4 text-right">€ {(lordo / VAT).toFixed(2)}</td>
        <td className="py-3.5 px-4 text-right">€ {lordo.toFixed(2)}</td>
        <td className="py-3.5 px-4 text-right">€ 0.00</td>
        <td className="py-3.5 px-4 text-right">€ 0.00</td>
        <td className="py-3.5 px-4 text-right">€ 0.00</td>
        <td className="py-3.5 px-4 text-right">{ricevute}</td>
      </>
    );

    return (
      <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto p-4 md:p-8 select-none">
        <div className="max-w-6xl mx-auto w-full space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex-1">{filterBar}</div>
            <button
              onClick={exportCsv}
              className="px-4 py-1.5 border border-tw-blue text-tw-blue hover:bg-blue-50 text-xs font-bold uppercase rounded-full shadow-xs transition"
            >
              ESPORTA CSV
            </button>
          </div>

          <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-x-auto">
            <table className="w-full min-w-[720px] text-xs text-left border-collapse">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50/50 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                  <th className="py-4 px-4 font-bold">GG</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. LORDO</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. NETTO</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. SERVIZI</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. RIVENDITA</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. PROMOZIONI</th>
                  <th className="py-4 px-4 font-bold text-right">IMP. FATTURE</th>
                  <th className="py-4 px-4 font-bold text-right">NUM. RICEVUTE</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 font-medium text-gray-700">
                {rows.length === 0 && (
                  <tr>
                    <td colSpan={8} className="py-8 text-center text-gray-400">
                      Nessun appuntamento nel periodo selezionato
                    </td>
                  </tr>
                )}
                {rows.map((r) => (
                  <tr key={r.gg} className="hover:bg-gray-50 transition">
                    <td className="py-3.5 px-4">{r.gg}</td>
                    {cells(r.lordo, r.ricevute)}
                  </tr>
                ))}
                {rows.length > 0 && (
                  <tr className="font-bold bg-blue-50/30 text-gray-900 text-sm">
                    <td className="py-3.5 px-4">Totale</td>
                    {cells(total.lordo, total.ricevute)}
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    );
  }

  const revenueSeries = buckets(current, from, to, 7, priceOf);
  const cards = [
    { label: 'RICAVI TOTALI', val: stats.revenue, series: revenueSeries },
    { label: 'SERVIZI', val: stats.revenue, series: revenueSeries },
    { label: 'PRODOTTI', val: 0, series: [0, 0] },
    { label: 'PROMOZIONI', val: 0, series: [0, 0] },
  ];

  return (
    <div className="flex-1 flex flex-col h-full bg-tw-canvas overflow-y-auto p-4 md:p-8 select-none">
      <div className="max-w-6xl mx-auto w-full space-y-6">
        {filterBar}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
          {cards.map((item) => (
            <div key={item.label} className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs space-y-3">
              <div className="flex items-center justify-between text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                <span>{item.label}</span>
                <Info className="w-3.5 h-3.5 text-gray-400" />
              </div>
              <div className="text-2xl font-light text-gray-900">{fmtEuro(item.val)}</div>
              <div className="h-6 w-full flex items-end">
                <Sparkline values={item.series} />
              </div>
            </div>
          ))}
        </div>

        <div className="bg-white rounded-2xl border border-gray-200 p-4 md:p-6 shadow-xs grid grid-cols-2 md:grid-cols-4 gap-y-4 md:divide-x divide-gray-100">
          <div className="pr-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">FICHE MEDIA</span>
            <div className="text-xl font-bold text-gray-800">
              € {stats.ficheMedia.toLocaleString('it-IT', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
            </div>
          </div>
          <div className="px-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">SERVIZI PER FICHE</span>
            <div className="text-xl font-bold text-gray-800">
              {stats.serviziPerFiche.toLocaleString('it-IT', { maximumFractionDigits: 1 })}
            </div>
          </div>
          <div className="px-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">% RIVENDITA SU PRESENZE</span>
            <div className="text-xl font-bold text-gray-800">0%</div>
          </div>
          <div className="pl-4 space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase">PRESENZE TOTALI</span>
            <div className="text-xl font-bold text-gray-800">{stats.presenze}</div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {[
            {
              title: 'PRESENZE',
              color: '#3584F6',
              value: () => 1,
              format: (n: number) => `${n}`,
            },
            { title: 'FATTURATO', color: '#10b981', value: priceOf, format: fmtEuro },
          ].map((chart) => (
            <div key={chart.title} className="bg-white rounded-2xl border border-gray-200 p-6 shadow-xs space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <span className="text-xs font-bold text-gray-700 uppercase">{chart.title}</span>
                <div className="flex items-center gap-4 text-[10px] text-gray-500 font-semibold">
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full" style={{ backgroundColor: chart.color }} />
                    Periodo selezionato
                  </span>
                  <span className="flex items-center gap-1">
                    <span className="w-2 h-2 rounded-full bg-amber-400" />
                    Periodo di confronto
                  </span>
                </div>
              </div>
              <BarChart
                current={buckets(current, from, to, 4, chart.value)}
                previous={buckets(previous, prevFrom, from, 4, chart.value)}
                color={chart.color}
                format={chart.format}
              />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
