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
