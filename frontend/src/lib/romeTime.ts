/** Convert a Europe/Rome wall time to UTC; reject nonexistent DST times. */
export function romeLocalToUtc(date: string, time: string): Date {
  const [hour, minute, second = 0] = time.split(':').map(Number);
  const wall = Date.parse(`${date}T${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}:${String(second).padStart(2, '0')}Z`);
  const formatter = new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/Rome', hourCycle: 'h23',
    year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit' });
  // Modern Rome offsets: CET and CEST. On the autumn fold choose standard time, matching PostgreSQL.
  for (const offset of [60, 120]) {
    const candidate = new Date(wall - offset * 60000);
    const p = Object.fromEntries(formatter.formatToParts(candidate).map(x => [x.type, x.value]));
    if (`${p.year}-${p.month}-${p.day}` === date && Number(p.hour) === hour && Number(p.minute) === minute && Number(p.second) === second) return candidate;
  }
  throw new Error('TB_START_INVALID: orario locale inesistente');
}

const ROME_DATE_PARTS = new Intl.DateTimeFormat('en-CA', {
  timeZone: 'Europe/Rome',
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
});

/** Return today's calendar date in the business timezone. */
export function getRomeToday(now = new Date()): string {
  const parts = Object.fromEntries(
    ROME_DATE_PARTS.formatToParts(now).map((part) => [part.type, part.value])
  );
  return `${parts.year}-${parts.month}-${parts.day}`;
}

/** Format an instant using the Europe/Rome business timezone. */
export function formatRomeDateTime(isoDate: string): {
  date: string;
  time: string;
  weekday: string;
  day: number;
  month: string;
} {
  const date = new Date(isoDate);
  if (Number.isNaN(date.getTime())) throw new Error('TB_INVALID_DATE');
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('it-IT', {
      timeZone: 'Europe/Rome',
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  const calendarParts = Object.fromEntries(
    new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Europe/Rome',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    })
      .formatToParts(date)
      .map((part) => [part.type, part.value])
  );
  return {
    date: `${calendarParts.year}-${calendarParts.month}-${calendarParts.day}`,
    time: `${parts.hour}:${parts.minute}`,
    weekday: parts.weekday,
    day: Number(parts.day),
    month: parts.month,
  };
}
