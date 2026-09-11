export interface AgendaDay {
  key: string;
  name: string;
  date: string;
  isClosed: boolean;
}

// I dati mock associano gli appuntamenti a queste date fisse (LUN 31 .. DOM 6):
// manteniamo questi numeri per non rompere l'associazione con gli appuntamenti demo.
const MOCK_DAY_NUMBERS = ['31', '1', '2', '3', '4', '5', '6'];
const DAY_NAMES = ['LUN', 'MAR', 'MER', 'GIO', 'VEN', 'SAB', 'DOM'];

export const AGENDA_DAYS: AgendaDay[] = DAY_NAMES.map((name, idx) => ({
  key: `${name} ${MOCK_DAY_NUMBERS[idx]}`,
  name,
  date: MOCK_DAY_NUMBERS[idx],
  isClosed: idx === 0 || idx === 6,
}));

export function getTodayIndex(): number {
  const jsDay = new Date().getDay(); // 0 = Domenica, 1 = Lunedì, ...
  return jsDay === 0 ? 6 : jsDay - 1; // rimappa su indice LUN..DOM
}

export function getTodayDayKey(): string {
  return AGENDA_DAYS[getTodayIndex()].key;
}

export function getTodayIsoDate(): string {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
    now.getDate()
  ).padStart(2, '0')}`;
}
