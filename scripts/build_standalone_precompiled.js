const fs = require('fs');
const path = require('path');
const vm = require('vm');

const rootDir = path.resolve(__dirname, '..');

// 1. Read mockData.ts to get all services and appointments
const mockDataContent = fs.readFileSync(
  path.join(rootDir, 'frontend/src/data/mockData.ts'),
  'utf8'
);

function extractArray(content, varName) {
  const startIdx = content.indexOf(`export const ${varName}`);
  if (startIdx === -1) throw new Error(`Could not find ${varName}`);
  const equalsIdx = content.indexOf('=', startIdx);
  const openBracket = content.indexOf('[', equalsIdx);

  let depth = 0;
  let inString = false;
  let stringChar = '';
  let closeBracket = -1;

  for (let i = openBracket; i < content.length; i++) {
    const char = content[i];
    const prev = content[i - 1];

    if (inString) {
      if (char === stringChar && prev !== '\\') {
        inString = false;
      }
    } else {
      if (char === "'" || char === '"' || char === '`') {
        inString = true;
        stringChar = char;
      } else if (char === '[') {
        depth++;
      } else if (char === ']') {
        depth--;
        if (depth === 0) {
          closeBracket = i;
          break;
        }
      }
    }
  }

  if (closeBracket === -1) throw new Error(`Could not balance brackets for ${varName}`);
  const rawArray = content.slice(openBracket, closeBracket + 1);
  const noComments = rawArray.replace(/\/\/.*$/gm, '');
  return eval('(' + noComments + ')');
}

const mockVenues = extractArray(mockDataContent, 'mockVenues');
const mockStaff = extractArray(mockDataContent, 'mockStaff');
const mockServices = extractArray(mockDataContent, 'mockServices');
const mockAppointments = extractArray(mockDataContent, 'mockAppointments');

console.log('Extracted data:');
console.log('- Venues:', mockVenues.length);
console.log('- Staff:', mockStaff.length);
console.log('- Services:', mockServices.length);
console.log('- Appointments:', mockAppointments.length);

async function main() {
  console.log('Downloading React & ReactDOM UMD...');
  const [reactUmd, reactDomUmd, babelCode] = await Promise.all([
    fetch('https://unpkg.com/react@18/umd/react.production.min.js').then(r => r.text()),
    fetch('https://unpkg.com/react-dom@18/umd/react-dom.production.min.js').then(r => r.text()),
    fetch('https://unpkg.com/@babel/standalone/babel.min.js').then(r => r.text()),
  ]);

  console.log('Initializing Babel compiler...');
  const sandbox = { window: {}, document: {}, navigator: {} };
  vm.createContext(sandbox);
  vm.runInContext(babelCode, sandbox);
  const Babel = sandbox.Babel || sandbox.window.Babel;

  // React JSX Application Code
  const appJsxCode = `
    const { useState, useEffect, useRef, useMemo } = React;

    // --- EMBEDDED DATA ---
    const RAW_VENUES = ${JSON.stringify(mockVenues, null, 2)};
    const RAW_STAFF = ${JSON.stringify(mockStaff, null, 2)};
    const RAW_SERVICES = ${JSON.stringify(mockServices, null, 2)};
    const RAW_APPOINTMENTS = ${JSON.stringify(mockAppointments, null, 2)};

    const AGENDA_DAYS = [
      { key: 'LUN 31', name: 'LUN', date: '31', isClosed: true },
      { key: 'MAR 1', name: 'MAR', date: '1', isClosed: false },
      { key: 'MER 2', name: 'MER', date: '2', isClosed: false, isToday: true },
      { key: 'GIO 3', name: 'GIO', date: '3', isClosed: false },
      { key: 'VEN 4', name: 'VEN', date: '4', isClosed: false },
      { key: 'SAB 5', name: 'SAB', date: '5', isClosed: false },
      { key: 'DOM 6', name: 'DOM', date: '6', isClosed: true },
    ];

    const DEFAULT_SALON_HOURS = [
      { day: 'Domenica', shortName: 'DOM', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
      { day: 'Lunedì', shortName: 'LUN', hours: 'Chiuso', isOpen: false, openTime: '08:00', closeTime: '19:00' },
      { day: 'Martedì', shortName: 'MAR', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
      { day: 'Mercoledì', shortName: 'MER', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
      { day: 'Giovedì', shortName: 'GIO', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
      { day: 'Venerdì', shortName: 'VEN', hours: '07:00 - 20:00', isOpen: true, openTime: '07:00', closeTime: '20:00' },
      { day: 'Sabato', shortName: 'SAB', hours: '08:00 - 18:00', isOpen: true, openTime: '08:00', closeTime: '18:00' },
    ];

    const TIME_SLOTS = [
      '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
      '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
      '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
      '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
      '19:00', '19:30', '20:00',
    ];

    const DURATION_STEPS = Array.from({ length: 40 }, (_, i) => (i + 1) * 15);

    // Helpers
    const toMinutes = (timeStr) => {
      if (!timeStr) return 0;
      const [h, m] = timeStr.split(':').map(Number);
      return (h || 0) * 60 + (m || 0);
    };

    const toTimeString = (totalMinutes) => {
      const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
      const h = Math.floor(clamped / 60);
      const m = clamped % 60;
      return String(h).padStart(2, '0') + ':' + String(m).padStart(2, '0');
    };

    const formatDurationHours = (minutes) => {
      const h = Math.floor(minutes / 60);
      const m = minutes % 60;
      return h + '.' + String(m).padStart(2, '0') + 'h';
    };

    const getIsoDateForDayKey = (dayKey) => {
      const found = AGENDA_DAYS.find(d => d.key === dayKey);
      if (!found) return '2026-09-02';
      const dayNum = found.date.padStart(2, '0');
      const month = found.date === '31' ? '08' : '09';
      return '2026-' + month + '-' + dayNum;
    };

    // --- ICONS (SVG) ---
    const Icon = ({ path, className = "w-4 h-4", viewBox = "0 0 24 24" }) => (
      <svg className={className} viewBox={viewBox} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        {path}
      </svg>
    );

    const Icons = {
      Calendar: (props) => <Icon {...props} path={<><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></>} />,
      ChevronLeft: (props) => <Icon {...props} path={<polyline points="15 18 9 12 15 6" />} />,
      ChevronRight: (props) => <Icon {...props} path={<polyline points="9 18 15 12 9 6" />} />,
      ChevronDown: (props) => <Icon {...props} path={<polyline points="6 9 12 15 18 9" />} />,
      Zap: (props) => <Icon {...props} path={<polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />} />,
      ClipboardList: (props) => <Icon {...props} path={<><path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2"/><rect x="8" y="2" width="8" height="4" rx="1" ry="1"/><path d="M12 11h4"/><path d="M12 16h4"/><path d="M8 11h.01"/><path d="M8 16h.01"/></>} />,
      ShieldCheck: (props) => <Icon {...props} path={<><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"/><polyline points="9 12 11 14 15 10"/></>} />,
      Menu: (props) => <Icon {...props} path={<><line x1="3" y1="12" x2="21" y2="12"/><line x1="3" y1="6" x2="21" y2="6"/><line x1="3" y1="18" x2="21" y2="18"/></>} />,
      X: (props) => <Icon {...props} path={<><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></>} />,
      Check: (props) => <Icon {...props} path={<polyline points="20 6 9 17 4 12" />} />,
      Search: (props) => <Icon {...props} path={<><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></>} />,
      Scissors: (props) => <Icon {...props} path={<><circle cx="6" cy="6" r="3"/><circle cx="6" cy="18" r="3"/><line x1="20" y1="4" x2="8.12" y2="15.88"/><line x1="14.47" y1="14.48" x2="20" y2="20"/><line x1="8.12" y1="8.12" x2="12" y2="12"/></>} />,
      Move: (props) => <Icon {...props} path={<><polyline points="5 9 2 12 5 15"/><polyline points="9 5 12 2 15 5"/><polyline points="15 19 12 22 9 19"/><polyline points="19 9 22 12 19 15"/><line x1="2" y1="12" x2="22" y2="12"/><line x1="12" y1="2" x2="12" y2="22"/></>} />,
      Armchair: (props) => <Icon {...props} path={<><path d="M19 9V6a2 2 0 0 0-2-2H7a2 2 0 0 0-2 2v3"/><path d="M3 11v5a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-5a2 2 0 0 0-4 0v2H7v-2a2 2 0 0 0-4 0z"/><line x1="5" y1="18" x2="5" y2="21"/><line x1="19" y1="18" x2="19" y2="21"/></>} />,
      Trash2: (props) => <Icon {...props} path={<><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><line x1="10" y1="11" x2="10" y2="17"/><line x1="14" y1="11" x2="14" y2="17"/></>} />,
      Printer: (props) => <Icon {...props} path={<><polyline points="6 9 6 2 18 2 18 9"/><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"/><rect x="6" y="14" width="12" height="8"/></>} />,
      Info: (props) => <Icon {...props} path={<><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></>} />,
      ListFilter: (props) => <Icon {...props} path={<><path d="M3 6h18"/><path d="M7 12h10"/><path d="M10 18h4"/></>} />,
      Heart: (props) => <Icon {...props} path={<path d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z" />} />,
      Smile: (props) => <Icon {...props} path={<><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></>} />,
      Clock: (props) => <Icon {...props} path={<><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></>} />,
      Cake: (props) => <Icon {...props} path={<><path d="M20 21v-8a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v8"/><path d="M4 16s.5-1 2-1 2.5 2 4 2 2.5-2 4-2 2.5 2 4 2 2-1 2-1"/><line x1="2" y1="21" x2="22" y2="21"/><line x1="12" y1="8" x2="12" y2="11"/><circle cx="12" cy="5" r="1"/></>} />,
      FileText: (props) => <Icon {...props} path={<><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></>} />,
      CreditCard: (props) => <Icon {...props} path={<><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></>} />,
      BookUser: (props) => <Icon {...props} path={<><path d="M4 19.5v-15A2.5 2.5 0 0 1 6.5 2H20v20H6.5a2.5 2.5 0 0 1-2.5-2.5Z"/><circle cx="12" cy="10" r="3"/><path d="M8 18c0-2.2 1.8-4 4-4s4 1.8 4 4"/></>} />,
      Tag: (props) => <Icon {...props} path={<path d="M20.59 13.41l-7.17 7.17a2 2 0 0 1-2.83 0L2 12V2h10l8.59 8.59a2 2 0 0 1 0 2.82zM7 7h.01"/>} />,
      Package: (props) => <Icon {...props} path={<><line x1="16.5" y1="9.4" x2="7.5" y2="4.21"/><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></>} />,
      Users: (props) => <Icon {...props} path={<><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/></>} />,
      PlayCircle: (props) => <Icon {...props} path={<><circle cx="12" cy="12" r="10"/><polygon points="10 8 16 12 10 16 10 8"/></>} />,
      Bell: (props) => <Icon {...props} path={<><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></>} />,
      MessageSquare: (props) => <Icon {...props} path={<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>} />,
      Sun: (props) => <Icon {...props} path={<><circle cx="12" cy="12" r="4"/><path d="M12 2v2"/><path d="M12 20v2"/><path d="m4.93 4.93 1.41 1.41"/><path d="m17.66 17.66 1.41 1.41"/><path d="M2 12h2"/><path d="M20 12h2"/><path d="m6.34 17.66-1.41 1.41"/><path d="m19.07 4.93-1.41 1.41"/></>} />,
      Moon: (props) => <Icon {...props} path={<path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z"/>} />,
      AlertTriangle: (props) => <Icon {...props} path={<><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></>} />,
      RotateCcw: (props) => <Icon {...props} path={<><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></>} />,
      Plus: (props) => <Icon {...props} path={<><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></>} />,
    };

    // --- MAIN APP COMPONENT ---
    function TurboBookingApp() {
      const [venues] = useState(RAW_VENUES);
      const [staffList] = useState(RAW_STAFF);
      const [services] = useState(RAW_SERVICES);
      const [appointments, setAppointments] = useState(RAW_APPOINTMENTS);

      const [activeVenueId, setActiveVenueId] = useState(RAW_VENUES[0].id);
      const [currentSection, setCurrentSection] = useState('agenda');
      const [viewMode, setViewMode] = useState('settimanale');
      const [selectedDay, setSelectedDay] = useState('MER 2');
      const [selectedStaffFilter, setSelectedStaffFilter] = useState('all');

      // Salon Hours and Day Overrides
      const [salonHours, setSalonHours] = useState(DEFAULT_SALON_HOURS);
      const [dayOverrides, setDayOverrides] = useState({});
      const [isDayScheduleOpen, setIsDayScheduleOpen] = useState(false);
      const [selectedScheduleDay, setSelectedScheduleDay] = useState(null);

      const handleSaveDaySchedule = (params) => {
        if (params.applyToAllMatchingDays) {
          setSalonHours(prev => prev.map(item => {
            if (item.shortName.toUpperCase() === params.dayName.toUpperCase() || item.day.toLowerCase() === params.dayName.toLowerCase()) {
              return {
                ...item,
                isOpen: params.isOpen,
                openTime: params.openTime,
                closeTime: params.closeTime,
                hours: params.isOpen ? (params.openTime + ' - ' + params.closeTime) : 'Chiuso',
              };
            }
            return item;
          }));
          setDayOverrides(prev => {
            const next = { ...prev };
            delete next[params.dayKey];
            return next;
          });
          showToast('Orario standard aggiornato per tutti i ' + params.dayName);
        } else {
          setDayOverrides(prev => ({
            ...prev,
            [params.dayKey]: {
              isOpen: params.isOpen,
              openTime: params.openTime,
              closeTime: params.closeTime,
            },
          }));
          showToast('Orario forzato impostato per ' + params.dayKey + ': ' + (params.isOpen ? (params.openTime + ' - ' + params.closeTime) : 'CHIUSO'));
        }
      };

      const handleResetDayOverride = (dayKey) => {
        setDayOverrides(prev => {
          const next = { ...prev };
          delete next[dayKey];
          return next;
        });
        showToast('Orario standard ripristinato per ' + dayKey);
      };

      // Modals state
      const [isDrawerOpen, setIsDrawerOpen] = useState(false);
      const [isDayOverviewOpen, setIsDayOverviewOpen] = useState(false);
      const [isFlashPromoOpen, setIsFlashPromoOpen] = useState(false);
      const [isAppointmentModalOpen, setIsAppointmentModalOpen] = useState(false);
      const [activeAppointment, setActiveAppointment] = useState(null);

      // Toast notification
      const [toastMessage, setToastMessage] = useState(null);
      const showToast = (msg) => {
        setToastMessage(msg);
        setTimeout(() => setToastMessage(null), 3500);
      };

      // Realtime clock
      const [timeStr, setTimeStr] = useState('01:24');
      useEffect(() => {
        const updateTime = () => {
          const now = new Date();
          setTimeStr(String(now.getHours()).padStart(2, '0') + ':' + String(now.getMinutes()).padStart(2, '0'));
        };
        updateTime();
        const interval = setInterval(updateTime, 10000);
        return () => clearInterval(interval);
      }, []);

      const handleStepDay = (direction) => {
        const idx = AGENDA_DAYS.findIndex(d => d.key === selectedDay);
        const nextIdx = Math.min(AGENDA_DAYS.length - 1, Math.max(0, (idx === -1 ? 2 : idx) + direction));
        setSelectedDay(AGENDA_DAYS[nextIdx].key);
      };

      const handleSelectAppointment = (app) => {
        setActiveAppointment(app);
        setIsAppointmentModalOpen(true);
      };

      const handleNewAppointmentAt = (dayKey, time, staffId) => {
        const staff = staffList.find(s => s.id === staffId) || staffList[0];
        const defaultSrv = services.find(s => s.id === 'srv-5') || services[0];

        const newApp = {
          id: 'app-' + Date.now(),
          clientId: 'cli-' + Date.now(),
          clientName: 'Cliente ' + (appointments.length + 1),
          clientPhone: '+39 34' + Math.floor(10000000 + Math.random() * 90000000),
          clientEmail: '',
          hasPrivacyConsent: true,
          serviceId: defaultSrv.id,
          serviceName: defaultSrv.name,
          serviceShortname: defaultSrv.shortname,
          serviceColor: defaultSrv.categoryColor,
          staffId: staff.id,
          staffInitials: staff.initials,
          staffName: staff.name,
          date: getIsoDateForDayKey(dayKey),
          dayOfWeek: dayKey,
          startTime: time,
          durationFormatted: formatDurationHours(defaultSrv.durationMinutes),
          durationMinutes: defaultSrv.durationMinutes,
          cleaningMinutes: 0,
          feePercentage: 0,
          source: 'DIRECT',
          status: 'confirmed',
          notes: '',
        };

        setActiveAppointment(newApp);
        setIsAppointmentModalOpen(true);
      };

      const handleSaveAppointment = (savedApp) => {
        setAppointments(prev => {
          const idx = prev.findIndex(a => a.id === savedApp.id);
          if (idx >= 0) {
            const copy = [...prev];
            copy[idx] = savedApp;
            return copy;
          }
          return [...prev, savedApp];
        });
        showToast('Appuntamento salvato: ' + savedApp.clientName + ' (' + savedApp.serviceName + ')');
      };

      const handleDeleteAppointment = (appId) => {
        setAppointments(prev => prev.filter(a => a.id !== appId));
        showToast('Appuntamento eliminato con successo');
      };

      return (
        <div className="flex h-screen w-screen overflow-hidden bg-tw-canvas antialiased text-tw-text-main font-sans">
          {/* 1. Left Venue Rail: ONLY GT */}
          <aside className="w-16 bg-tw-rail flex flex-col items-center py-4 gap-3 select-none flex-shrink-0 z-30 shadow-md">
            {venues.map(venue => {
              const isActive = venue.id === activeVenueId;
              return (
                <div key={venue.id} className="flex flex-col items-center gap-1 group">
                  <button
                    onClick={() => setActiveVenueId(venue.id)}
                    title={venue.name}
                    className={'relative w-12 h-12 rounded-xl flex items-center justify-center font-bold text-base transition-all duration-200 ' +
                      (isActive
                        ? 'bg-white text-tw-rail-dark shadow-md ring-2 ring-white/50 scale-105'
                        : 'bg-white/20 text-white hover:bg-white/30 hover:scale-102')
                    }
                  >
                    <span>{venue.shortname}</span>
                    {/* Online indicator */}
                    <span className="absolute -top-1 -right-1 w-3.5 h-3.5 bg-emerald-500 border-2 border-tw-rail rounded-full shadow-sm" />
                  </button>
                  <span className="text-[10px] text-white/80 font-medium tracking-tight">
                    {venue.shortname}
                  </span>
                </div>
              );
            })}
          </aside>

          {/* 2. Main Content Column */}
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Top Header */}
            <header className="h-14 bg-white border-b border-tw-border flex items-center justify-between px-4 select-none z-20">
              {currentSection === 'agenda' ? (
                <div className="flex items-center gap-3">
                  <button className="p-1.5 hover:bg-gray-100 rounded-md text-gray-600 transition">
                    <Icons.Calendar className="w-5 h-5 text-gray-700" />
                  </button>
                  <span className="font-semibold text-xs text-gray-700 uppercase tracking-wide">AGO</span>
                  <div className="flex items-center gap-1 bg-gray-50 border border-gray-200 rounded-md px-2.5 py-1 text-xs text-tw-blue font-semibold">
                    {viewMode === 'settimanale' ? (
                      <>
                        <span>LUN 31</span>
                        <span className="text-gray-400">→</span>
                        <span>DOM 06</span>
                      </>
                    ) : (
                      <span>{selectedDay}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-0.5 text-gray-500">
                    <button
                      onClick={() => handleStepDay(-1)}
                      className="p-1 hover:bg-gray-100 rounded transition cursor-pointer"
                      title={viewMode === 'giornaliero' ? 'Giorno precedente' : 'Settimana precedente'}
                    >
                      <Icons.ChevronLeft className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleStepDay(1)}
                      className="p-1 hover:bg-gray-100 rounded transition cursor-pointer"
                      title={viewMode === 'giornaliero' ? 'Giorno successivo' : 'Settimana successiva'}
                    >
                      <Icons.ChevronRight className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex items-center gap-3">
                  <button
                    onClick={() => setCurrentSection('agenda')}
                    className="flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-xs font-bold transition cursor-pointer"
                  >
                    <Icons.ChevronLeft className="w-4 h-4" />
                    <span>Torna all'Agenda</span>
                  </button>
                  <div className="flex items-center gap-2">
                    <Icons.Clock className="w-4 h-4 text-tw-blue" />
                    <span className="font-bold text-xs sm:text-sm text-gray-800">Orari e Disponibilità Salone</span>
                  </div>
                </div>
              )}

              {/* Digital Clock */}
              <div className="font-mono text-base font-semibold text-gray-500 tracking-tight">
                {timeStr}
              </div>

              {/* Right: Controls & Actions */}
              <div className="flex items-center gap-3">
                {currentSection === 'agenda' && (
                  <>
                    {/* View Switcher */}
                    <div className="relative">
                      <select
                        value={viewMode}
                        onChange={(e) => setViewMode(e.target.value)}
                        className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-tw-blue cursor-pointer"
                      >
                        <option value="settimanale">Settimanale</option>
                        <option value="giornaliero">Giornaliero</option>
                      </select>
                      <span className="absolute right-2 top-2 pointer-events-none text-[10px] text-gray-400">⌄</span>
                    </div>

                    {/* Staff Filter */}
                    <div className="relative">
                      <select
                        value={selectedStaffFilter}
                        onChange={(e) => setSelectedStaffFilter(e.target.value)}
                        className="appearance-none bg-white border border-gray-200 rounded-md px-3 py-1.5 pr-7 text-xs font-medium text-gray-700 hover:bg-gray-50 focus:outline-none focus:ring-1 focus:ring-tw-blue cursor-pointer"
                      >
                        <option value="all">Tutti i collaboratori</option>
                        {staffList.map(st => (
                          <option key={st.id} value={st.id}>{st.name}</option>
                        ))}
                      </select>
                      <span className="absolute right-2 top-2 pointer-events-none text-[10px] text-gray-400">⌄</span>
                    </div>

                    {/* Header Action Buttons */}
                    <div className="flex items-center gap-1 border-l border-gray-200 pl-2">
                      <button
                        onClick={() => setIsFlashPromoOpen(true)}
                        title="Promo Flash"
                        className="p-2 hover:bg-blue-50 text-gray-600 hover:text-tw-blue rounded-md transition"
                      >
                        <Icons.Zap className="w-4 h-4 text-amber-500" />
                      </button>

                      <button
                        onClick={() => setIsDayOverviewOpen(true)}
                        title="Panoramica del Giorno"
                        className="p-2 hover:bg-blue-50 text-gray-600 hover:text-tw-blue rounded-md transition"
                      >
                        <Icons.ClipboardList className="w-4 h-4 text-tw-blue" />
                      </button>

                      <button
                        title="Conforme GDPR & Normativa Fiscale"
                        className="p-2 hover:bg-gray-100 text-gray-500 rounded-md transition"
                      >
                        <Icons.ShieldCheck className="w-4 h-4 text-emerald-600" />
                      </button>
                    </div>
                  </>
                )}

                <button
                  onClick={() => setIsDrawerOpen(true)}
                  title="Apri Menu Principale"
                  className="p-2 hover:bg-gray-100 text-gray-700 hover:text-tw-blue rounded-md transition ml-1"
                >
                  <Icons.Menu className="w-5 h-5" />
                </button>
              </div>
            </header>

            {/* Main Content Area: Agenda or Orari */}
            <main className="flex-1 overflow-hidden relative flex flex-col">
              {currentSection === 'agenda' ? (
                <AgendaGridView
                  appointments={appointments}
                  staffList={staffList}
                  selectedStaffFilter={selectedStaffFilter}
                  viewMode={viewMode}
                  selectedDay={selectedDay}
                  salonHours={salonHours}
                  dayOverrides={dayOverrides}
                  onOpenDaySchedule={(day) => {
                    setSelectedScheduleDay(day);
                    setIsDayScheduleOpen(true);
                  }}
                  onSelectAppointment={handleSelectAppointment}
                  onNewAppointmentAt={handleNewAppointmentAt}
                  onUpdateAppointment={handleSaveAppointment}
                  showToast={showToast}
                />
              ) : (
                <OrariStandaloneView
                  salonHours={salonHours}
                  onUpdateSalonHours={setSalonHours}
                  onBack={() => setCurrentSection('agenda')}
                  showToast={showToast}
                />
              )}
            </main>
          </div>

          {/* Toast Alert */}
          {toastMessage && (
            <div className="fixed bottom-6 right-6 z-50 bg-gray-900 text-white px-5 py-3 rounded-2xl shadow-2xl flex items-center gap-3 border border-gray-700 animate-in fade-in slide-in-from-bottom-4 duration-200">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 animate-ping" />
              <span className="text-xs font-semibold">{toastMessage}</span>
            </div>
          )}

          {/* Drawer Menu */}
          <SlideDrawer
            isOpen={isDrawerOpen}
            onClose={() => setIsDrawerOpen(false)}
            currentSection={currentSection}
            onSelectSection={setCurrentSection}
            onOpenDayOverview={() => setIsDayOverviewOpen(true)}
            onOpenFlashPromo={() => setIsFlashPromoOpen(true)}
            showToast={showToast}
          />

          {/* Day Schedule Modal (Direct Day Override from Agenda) */}
          <DayScheduleDialog
            isOpen={isDayScheduleOpen}
            onClose={() => {
              setIsDayScheduleOpen(false);
              setSelectedScheduleDay(null);
            }}
            day={selectedScheduleDay}
            onSave={handleSaveDaySchedule}
            onResetOverride={handleResetDayOverride}
          />

          {/* Day Overview Modal */}
          <DayOverviewDialog
            isOpen={isDayOverviewOpen}
            onClose={() => setIsDayOverviewOpen(false)}
            appointments={appointments}
            onOpenFlashPromo={() => {
              setIsDayOverviewOpen(false);
              setIsFlashPromoOpen(true);
            }}
          />

          {/* Flash Promo Modal */}
          <FlashPromoDialog
            isOpen={isFlashPromoOpen}
            onClose={() => setIsFlashPromoOpen(false)}
            onSavePromo={(promo) => {
              setIsFlashPromoOpen(false);
              showToast('Promo Flash attivata: ' + promo.discount + ' per ' + promo.duration);
            }}
          />

          {/* Appointment Modal: max-w-4xl, Searchable, only Salva Appuntamento */}
          <AppointmentDialog
            isOpen={isAppointmentModalOpen}
            onClose={() => {
              setIsAppointmentModalOpen(false);
              setActiveAppointment(null);
            }}
            appointment={activeAppointment}
            services={services}
            staffList={staffList}
            onSave={handleSaveAppointment}
            onDelete={handleDeleteAppointment}
          />
        </div>
      );
    }

    // --- AGENDA GRID VIEW WITH DRAG & DROP & RESIZE ---
    function AgendaGridView({
      appointments,
      staffList,
      selectedStaffFilter,
      viewMode,
      selectedDay,
      salonHours,
      dayOverrides,
      onOpenDaySchedule,
      onSelectAppointment,
      onNewAppointmentAt,
      onUpdateAppointment,
      showToast,
    }) {
      const [resizingState, setResizingState] = useState(null);
      const [draggingState, setDraggingState] = useState(null);
      const justResizedRef = useRef(false);

      const daysWithSchedule = useMemo(() => {
        return AGENDA_DAYS.map((day) => {
          const override = dayOverrides && dayOverrides[day.key];
          const standard = salonHours && salonHours.find(s => s.shortName === day.name);

          const isOpen = override
            ? override.isOpen
            : standard
            ? standard.isOpen
            : !day.isClosed;

          const openTime = override ? override.openTime : standard ? standard.openTime : (day.name === 'SAB' ? '08:00' : '07:00');
          const closeTime = override ? override.closeTime : standard ? standard.closeTime : (day.name === 'SAB' ? '18:00' : '20:00');
          const isOverridden = !!override;

          return {
            ...day,
            isToday: day.key === 'MER 2',
            isOpen,
            isClosed: !isOpen,
            openTime,
            closeTime,
            isOverridden,
          };
        });
      }, [salonHours, dayOverrides]);

      const days = useMemo(() => {
        if (viewMode === 'giornaliero') {
          return daysWithSchedule.filter(d => d.key === selectedDay);
        }
        return daysWithSchedule;
      }, [viewMode, selectedDay, daysWithSchedule]);

      const filteredStaff = useMemo(() => {
        if (selectedStaffFilter === 'all') return staffList;
        return staffList.filter(s => s.id === selectedStaffFilter);
      }, [staffList, selectedStaffFilter]);

      // --- Pointer Handlers for Resizing ---
      const handlePointerDownTop = (e, app) => {
        e.stopPropagation();
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch(err) {}

        const startMinutes = toMinutes(app.startTime);
        setResizingState({
          appId: app.id,
          edge: 'top',
          initialY: e.clientY,
          initialStartMinutes: startMinutes,
          initialDurationMinutes: app.durationMinutes,
          currentStartTime: app.startTime,
          currentDurationMinutes: app.durationMinutes,
          currentDurationFormatted: app.durationFormatted,
        });
      };

      const handlePointerDownBottom = (e, app) => {
        e.stopPropagation();
        e.preventDefault();
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch(err) {}

        const startMinutes = toMinutes(app.startTime);
        setResizingState({
          appId: app.id,
          edge: 'bottom',
          initialY: e.clientY,
          initialStartMinutes: startMinutes,
          initialDurationMinutes: app.durationMinutes,
          currentStartTime: app.startTime,
          currentDurationMinutes: app.durationMinutes,
          currentDurationFormatted: app.durationFormatted,
        });
      };

      // --- Pointer Handlers for Card Dragging ---
      const handlePointerDownCard = (e, app) => {
        if (e.button !== 0) return;
        if (resizingState) return;
        try { e.currentTarget.setPointerCapture(e.pointerId); } catch(err) {}

        const startMinutes = toMinutes(app.startTime);
        setDraggingState({
          appId: app.id,
          initialX: e.clientX,
          initialY: e.clientY,
          hasMoved: false,
          initialStartMinutes: startMinutes,
          durationMinutes: app.durationMinutes,
          durationFormatted: app.durationFormatted,
          initialDayOfWeek: app.dayOfWeek,
          initialStaffId: app.staffId,
          currentStartTime: app.startTime,
          currentDayOfWeek: app.dayOfWeek,
          currentStaffId: app.staffId,
        });
      };

      const handlePointerMove = (e) => {
        if (resizingState) {
          const deltaY = e.clientY - resizingState.initialY;
          const rawDeltaMinutes = deltaY * (30 / 56);
          const snapMinutes = Math.round(rawDeltaMinutes / 15) * 15;

          if (resizingState.edge === 'bottom') {
            const newDuration = Math.max(15, resizingState.initialDurationMinutes + snapMinutes);
            const maxDuration = 20 * 60 - resizingState.initialStartMinutes;
            const clampedDuration = Math.min(newDuration, Math.max(15, maxDuration));

            setResizingState(prev => prev ? {
              ...prev,
              currentDurationMinutes: clampedDuration,
              currentDurationFormatted: formatDurationHours(clampedDuration),
            } : null);
          } else if (resizingState.edge === 'top') {
            const originalEndMinutes = resizingState.initialStartMinutes + resizingState.initialDurationMinutes;
            let newStartMinutes = resizingState.initialStartMinutes + snapMinutes;
            newStartMinutes = Math.max(7 * 60, newStartMinutes);
            if (originalEndMinutes - newStartMinutes < 15) {
              newStartMinutes = originalEndMinutes - 15;
            }
            const clampedDuration = originalEndMinutes - newStartMinutes;
            const newStartTimeStr = toTimeString(newStartMinutes);

            setResizingState(prev => prev ? {
              ...prev,
              currentStartTime: newStartTimeStr,
              currentDurationMinutes: clampedDuration,
              currentDurationFormatted: formatDurationHours(clampedDuration),
            } : null);
          }
          return;
        }

        if (draggingState) {
          const deltaX = Math.abs(e.clientX - draggingState.initialX);
          const deltaY = Math.abs(e.clientY - draggingState.initialY);
          const hasMoved = draggingState.hasMoved || deltaX > 4 || deltaY > 4;

          const rawDeltaMinutes = (e.clientY - draggingState.initialY) * (30 / 56);
          const snapMinutes = Math.round(rawDeltaMinutes / 15) * 15;
          const newStartMinutes = Math.max(
            7 * 60,
            Math.min(
              20 * 60 - draggingState.durationMinutes,
              draggingState.initialStartMinutes + snapMinutes
            )
          );
          const newStartTimeStr = toTimeString(newStartMinutes);

          let targetDay = draggingState.currentDayOfWeek;
          let targetStaffId = draggingState.currentStaffId;

          if (document.elementsFromPoint) {
            const elements = document.elementsFromPoint(e.clientX, e.clientY);
            for (const el of elements) {
              const col = el.closest ? el.closest('[data-agenda-column="true"]') : null;
              if (col && col.dataset.day && col.dataset.staffId) {
                if (col.dataset.isClosed !== 'true') {
                  targetDay = col.dataset.day;
                  targetStaffId = col.dataset.staffId;
                }
                break;
              }
            }
          }

          setDraggingState(prev => prev ? {
            ...prev,
            hasMoved,
            currentStartTime: newStartTimeStr,
            currentDayOfWeek: targetDay,
            currentStaffId: targetStaffId,
          } : null);
        }
      };

      const handlePointerUp = (e) => {
        if (resizingState) {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
          const targetApp = appointments.find(a => a.id === resizingState.appId);
          if (targetApp && onUpdateAppointment) {
            const updatedApp = {
              ...targetApp,
              startTime: resizingState.currentStartTime,
              durationMinutes: resizingState.currentDurationMinutes,
              durationFormatted: resizingState.currentDurationFormatted,
            };
            onUpdateAppointment(updatedApp);
            showToast('Orario modificato: ' + updatedApp.startTime + ' (' + updatedApp.durationFormatted + ')');
          }
          justResizedRef.current = true;
          setResizingState(null);
          return;
        }

        if (draggingState) {
          try { e.currentTarget.releasePointerCapture(e.pointerId); } catch(err) {}
          if (draggingState.hasMoved) {
            const targetApp = appointments.find(a => a.id === draggingState.appId);
            if (targetApp && onUpdateAppointment) {
              const targetStaff = staffList.find(s => s.id === draggingState.currentStaffId) || staffList[0];
              const updatedApp = {
                ...targetApp,
                startTime: draggingState.currentStartTime,
                dayOfWeek: draggingState.currentDayOfWeek,
                date: getIsoDateForDayKey(draggingState.currentDayOfWeek),
                staffId: targetStaff.id,
                staffName: targetStaff.name,
                staffInitials: targetStaff.initials,
              };
              onUpdateAppointment(updatedApp);
              showToast('Appuntamento spostato a ' + updatedApp.dayOfWeek + ' ore ' + updatedApp.startTime + ' con ' + updatedApp.staffName);
            }
            justResizedRef.current = true;
          }
          setDraggingState(null);
        }
      };

      return (
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-none">
          {/* Header Row: Days & Staff Columns */}
          <div className="flex border-b border-gray-200 bg-gray-50/70 sticky top-0 z-10">
            <div className="w-16 border-r border-gray-200 flex-shrink-0" />
            <div
              className="flex-1 grid divide-x divide-gray-200"
              style={{ gridTemplateColumns: 'repeat(' + days.length + ', minmax(0, 1fr))' }}
            >
              {days.map(day => (
                <div
                  key={day.key}
                  onClick={() => onOpenDaySchedule && onOpenDaySchedule(day)}
                  title="Clicca per modificare orari o forzare apertura/chiusura per questo giorno"
                  className={'flex flex-col text-center py-2 transition cursor-pointer select-none group/day relative ' +
                    (day.isToday
                      ? 'bg-blue-50/60 hover:bg-blue-100/70'
                      : day.isClosed
                      ? 'bg-gray-100/70 hover:bg-gray-200/70'
                      : 'hover:bg-blue-50/50')
                  }
                >
                  <div className="text-[11px] font-bold text-gray-700 flex items-center justify-center gap-1">
                    <span>{day.name}</span>
                    <span className={day.isToday ? 'text-tw-blue font-extrabold' : ''}>
                      {day.date}
                    </span>
                    <Icons.Clock className="w-3 h-3 text-gray-400 group-hover/day:text-tw-blue transition opacity-40 group-hover/day:opacity-100" />
                  </div>

                  {/* Status or Overridden badge */}
                  {day.isClosed ? (
                    <div className="mt-0.5">
                      <span className="bg-rose-100 text-rose-700 text-[9px] font-extrabold px-1.5 py-0.5 rounded-md uppercase tracking-wider">
                        CHIUSO
                      </span>
                    </div>
                  ) : day.isOverridden ? (
                    <div className="mt-0.5">
                      <span className="bg-amber-100 text-amber-800 text-[9px] font-bold px-1.5 py-0.5 rounded-md font-mono">
                        {day.openTime} - {day.closeTime}
                      </span>
                    </div>
                  ) : null}

                  <div className="flex justify-around mt-1 pt-1 border-t border-gray-200/60 text-[10px] text-gray-500 font-semibold">
                    {filteredStaff.map(st => (
                      <span key={st.id}>{st.initials}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Grid Scrollable Body */}
          <div className="flex-1 overflow-y-auto relative">
            <div className="flex">
              {/* Time Gutter */}
              <div className="w-16 border-r border-gray-200 flex-shrink-0 divide-y divide-gray-100 bg-white">
                {TIME_SLOTS.map(time => (
                  <div
                    key={time}
                    className="h-14 px-2 py-1 text-[11px] font-medium text-gray-500 text-right flex items-start justify-end"
                  >
                    {time}
                  </div>
                ))}
              </div>

              {/* Days & Staff Columns */}
              <div
                className="flex-1 grid divide-x divide-gray-200"
                style={{ gridTemplateColumns: 'repeat(' + days.length + ', minmax(0, 1fr))' }}
              >
                {days.map(day => (
                  <div
                    key={day.key}
                    className={'relative flex divide-x divide-gray-100 ' + (day.isClosed ? 'bg-tw-hatch' : 'bg-white')}
                  >
                    {filteredStaff.map(staff => (
                      <div
                        key={staff.id}
                        data-agenda-column="true"
                        data-day={day.key}
                        data-staff-id={staff.id}
                        data-is-closed={day.isClosed ? 'true' : 'false'}
                        className="flex-1 relative divide-y divide-gray-100 min-w-0"
                      >
                        {/* Time slots rows */}
                        {TIME_SLOTS.map(time => {
                          const isClosedHour = day.isClosed || time < (day.openTime || '07:00') || time >= (day.closeTime || '20:00');
                          return (
                            <div
                              key={time}
                              onClick={() => {
                                if (isClosedHour) {
                                  if (onOpenDaySchedule) onOpenDaySchedule(day);
                                } else {
                                  onNewAppointmentAt(day.key, time, staff.id);
                                }
                              }}
                              title={isClosedHour ? 'Giorno o orario chiuso al pubblico. Clicca per modificare gli orari del salone.' : undefined}
                              className={'h-14 transition cursor-pointer relative group ' +
                                (isClosedHour
                                  ? 'bg-tw-hatch cursor-pointer opacity-85 hover:opacity-100'
                                  : 'hover:bg-blue-50/40')
                              }
                            >
                              {!isClosedHour && (
                                <div className="hidden group-hover:flex items-center justify-center h-full text-tw-blue font-bold text-xs opacity-40">
                                  +
                                </div>
                              )}
                              {isClosedHour && (
                                <div className="hidden group-hover:flex items-center justify-center h-full text-gray-400 font-semibold text-[10px]">
                                  Chiuso
                                </div>
                              )}
                            </div>
                          );
                        })}

                        {/* Ghost Card at Original Location During Drag */}
                        {draggingState && draggingState.hasMoved &&
                         draggingState.initialDayOfWeek === day.key &&
                         draggingState.initialStaffId === staff.id && (() => {
                          const origStartTotal = draggingState.initialStartMinutes - 7 * 60;
                          const origTop = (origStartTotal / 30) * 56;
                          const origHeight = Math.max((draggingState.durationMinutes / 30) * 56 - 4, 28);
                          return (
                            <div
                              style={{ top: origTop + 'px', height: origHeight + 'px' }}
                              className="absolute inset-x-1 rounded-lg p-2 border-2 border-dashed border-tw-blue/60 bg-blue-50/50 text-tw-blue text-xs flex flex-col justify-between pointer-events-none z-10"
                            >
                              <div className="font-bold text-[11px] truncate opacity-80">
                                Spostamento in corso...
                              </div>
                              <div className="text-[10px] font-mono opacity-70">
                                Da: {toTimeString(draggingState.initialStartMinutes)}
                              </div>
                            </div>
                          );
                        })()}

                        {/* Render Appointments */}
                        {appointments
                          .filter(app => {
                            const isThisAppDragged = draggingState && draggingState.appId === app.id;
                            const effectiveDay = isThisAppDragged ? draggingState.currentDayOfWeek : app.dayOfWeek;
                            const effectiveStaff = isThisAppDragged ? draggingState.currentStaffId : app.staffId;
                            return effectiveDay === day.key && (effectiveStaff === staff.id || app.staffInitials === staff.initials);
                          })
                          .map(app => {
                            const isBeingResized = resizingState && resizingState.appId === app.id;
                            const isBeingDragged = draggingState && draggingState.appId === app.id && draggingState.hasMoved;

                            const effectiveStartTime = isBeingResized
                              ? resizingState.currentStartTime
                              : isBeingDragged
                              ? draggingState.currentStartTime
                              : app.startTime;
                            const effectiveDurationMinutes = isBeingResized
                              ? resizingState.currentDurationMinutes
                              : app.durationMinutes;
                            const effectiveDurationFormatted = isBeingResized
                              ? resizingState.currentDurationFormatted
                              : app.durationFormatted;

                            const [hours, minutes] = effectiveStartTime.split(':').map(Number);
                            const startTotalMinutes = hours * 60 + minutes - 7 * 60;
                            const topPixels = (startTotalMinutes / 30) * 56;
                            const heightPixels = Math.max((effectiveDurationMinutes / 30) * 56 - 4, 28);
                            const endTotalMinutes = toMinutes(effectiveStartTime) + effectiveDurationMinutes;
                            const endTimeStr = toTimeString(endTotalMinutes);

                            return (
                              <div
                                key={app.id}
                                onPointerDown={(e) => handlePointerDownCard(e, app)}
                                onPointerMove={handlePointerMove}
                                onPointerUp={handlePointerUp}
                                onPointerCancel={handlePointerUp}
                                onClick={(e) => {
                                  e.stopPropagation();
                                  if (resizingState || (draggingState && draggingState.hasMoved) || justResizedRef.current) {
                                    justResizedRef.current = false;
                                    return;
                                  }
                                  onSelectAppointment(app);
                                }}
                                style={{
                                  top: topPixels + 'px',
                                  height: heightPixels + 'px',
                                  backgroundColor: app.serviceColor || '#1B6478',
                                }}
                                className={'group absolute inset-x-1 rounded-lg p-2 text-white text-xs shadow-md border-l-4 border-white/80 flex flex-col justify-between select-none touch-none transition-shadow ' +
                                  (isBeingDragged
                                    ? 'ring-4 ring-tw-blue shadow-2xl z-50 brightness-110 scale-[1.02] cursor-grabbing opacity-95'
                                    : isBeingResized
                                    ? 'ring-2 ring-tw-blue shadow-xl z-30 brightness-105 cursor-ns-resize'
                                    : 'cursor-grab hover:shadow-lg hover:brightness-95 z-20 active:cursor-grabbing')
                                }
                                title="Trascina al centro per spostare, o clicca per modificare"
                              >
                                {/* Top Resize Handle */}
                                <div
                                  onPointerDown={(e) => handlePointerDownTop(e, app)}
                                  onPointerMove={handlePointerMove}
                                  onPointerUp={handlePointerUp}
                                  onPointerCancel={handlePointerUp}
                                  className="absolute top-0 inset-x-0 h-3 cursor-ns-resize z-20 group/handle flex items-start justify-center touch-none"
                                  title="Trascina bordo superiore per anticipare/ritardare l'inizio"
                                >
                                  <div className="w-8 h-1 rounded-full bg-white/40 group-hover/handle:bg-white group-active/handle:bg-white shadow-xs transition mt-0.5" />
                                </div>

                                {/* Dragging Floating Tooltip */}
                                {isBeingDragged && (
                                  <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-2">
                                    <span className="text-blue-300 uppercase tracking-wide">{day.name} {day.date}</span>
                                    <span>•</span>
                                    <span>{effectiveStartTime} – {endTimeStr}</span>
                                    <span>•</span>
                                    <span className="text-amber-300 font-semibold">{staff.name}</span>
                                  </div>
                                )}

                                {/* Resizing Floating Tooltip */}
                                {isBeingResized && (
                                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap z-40 pointer-events-none flex items-center gap-1.5">
                                    <span>{effectiveStartTime} – {endTimeStr}</span>
                                    <span className="text-blue-300 font-mono">({effectiveDurationFormatted})</span>
                                  </div>
                                )}

                                {/* Appointment Content */}
                                <div className="font-bold leading-tight truncate pointer-events-none mt-0.5 flex items-center justify-between">
                                  <span className="truncate uppercase text-[11px] tracking-tight">{app.clientName}</span>
                                  <Icons.Move className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1" />
                                </div>
                                <div className="text-[10px] text-white/95 font-medium truncate flex items-center justify-between pointer-events-none mb-0.5">
                                  <div className="flex items-center gap-1.5 truncate">
                                    <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0 inline-block shadow-xs" />
                                    <span className="truncate uppercase">{app.serviceName}</span>
                                  </div>
                                  <span className="font-mono text-[9px] font-semibold shrink-0 ml-1 text-white/90">{effectiveDurationFormatted}</span>
                                </div>

                                {/* Bottom Resize Handle */}
                                <div
                                  onPointerDown={(e) => handlePointerDownBottom(e, app)}
                                  onPointerMove={handlePointerMove}
                                  onPointerUp={handlePointerUp}
                                  onPointerCancel={handlePointerUp}
                                  className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize z-20 group/handle flex items-end justify-center touch-none"
                                  title="Trascina bordo inferiore per allungare/accorciare la durata"
                                >
                                  <div className="w-8 h-1 rounded-full bg-white/40 group-hover/handle:bg-white group-active/handle:bg-white shadow-xs transition mb-0.5" />
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- APPOINTMENT MODAL (max-w-4xl, Searchable, only Salva Appuntamento) ---
    function AppointmentDialog({
      isOpen,
      onClose,
      appointment,
      services,
      staffList,
      onSave,
      onDelete,
    }) {
      const [clientName, setClientName] = useState('');
      const [clientPhone, setClientPhone] = useState('');
      const [clientEmail, setClientEmail] = useState('');
      const [hasPrivacyConsent, setHasPrivacyConsent] = useState(true);
      const [serviceId, setServiceId] = useState('');
      const [staffId, setStaffId] = useState('');
      const [durationMinutes, setDurationMinutes] = useState(45);
      const [notes, setNotes] = useState('');

      // Dropdown search & filter state
      const [isServiceDropdownOpen, setIsServiceDropdownOpen] = useState(false);
      const [serviceSearchQuery, setServiceSearchQuery] = useState('');
      const [selectedCategoryFilter, setSelectedCategoryFilter] = useState('TUTTI');

      const dropdownRef = useRef(null);
      const searchInputRef = useRef(null);

      const defaultService = useMemo(() => {
        return (
          services.find(s => s.id === 'srv-5') ||
          services.find(s => s.name.toLowerCase().includes('taglio uomo top stylist')) ||
          services[0]
        );
      }, [services]);

      const categories = useMemo(() => {
        const set = new Set(services.map(s => s.category).filter(Boolean));
        return ['TUTTI', ...Array.from(set)];
      }, [services]);

      const filteredServices = useMemo(() => {
        const q = serviceSearchQuery.toLowerCase().trim();
        return services.filter(srv => {
          const matchCat = selectedCategoryFilter === 'TUTTI' || srv.category === selectedCategoryFilter;
          const matchQuery = !q ||
            srv.name.toLowerCase().includes(q) ||
            srv.category.toLowerCase().includes(q) ||
            srv.shortname.toLowerCase().includes(q);
          return matchCat && matchQuery;
        });
      }, [services, serviceSearchQuery, selectedCategoryFilter]);

      useEffect(() => {
        const handleClickOutside = (e) => {
          if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
            setIsServiceDropdownOpen(false);
          }
        };
        if (isServiceDropdownOpen) {
          document.addEventListener('mousedown', handleClickOutside);
        }
        return () => document.removeEventListener('mousedown', handleClickOutside);
      }, [isServiceDropdownOpen]);

      useEffect(() => {
        if (isServiceDropdownOpen && searchInputRef.current) {
          searchInputRef.current.focus();
        }
      }, [isServiceDropdownOpen]);

      useEffect(() => {
        if (appointment) {
          setClientName(appointment.clientName || '');
          setClientPhone(appointment.clientPhone || '');
          setClientEmail(appointment.clientEmail || '');
          setHasPrivacyConsent(appointment.hasPrivacyConsent ?? true);
          setServiceId(appointment.serviceId || defaultService.id);
          setStaffId(appointment.staffId || staffList[0]?.id);
          setDurationMinutes(appointment.durationMinutes || defaultService.durationMinutes || 45);
          setNotes(appointment.notes || '');
        } else {
          setClientName('');
          setClientPhone('');
          setClientEmail('');
          setHasPrivacyConsent(true);
          setServiceId(defaultService.id);
          setStaffId(staffList[0]?.id || '');
          setDurationMinutes(defaultService.durationMinutes || 45);
          setNotes('');
        }
        setIsServiceDropdownOpen(false);
        setServiceSearchQuery('');
        setSelectedCategoryFilter('TUTTI');
      }, [appointment, services, staffList, defaultService]);

      if (!isOpen) return null;

      const currentService = services.find(s => s.id === serviceId) || defaultService;
      const currentStaff = staffList.find(st => st.id === staffId) || staffList[0];

      const handleSaveClick = () => {
        const appToSave = {
          id: appointment?.id || ('app-' + Date.now()),
          clientId: appointment?.clientId || ('cli-' + Date.now()),
          clientName: clientName.trim() || 'Nuovo Cliente',
          clientPhone: clientPhone.trim() || '+39 340 0000000',
          clientEmail: clientEmail.trim(),
          hasPrivacyConsent,
          serviceId: currentService.id,
          serviceName: currentService.name,
          serviceShortname: currentService.shortname,
          serviceColor: currentService.categoryColor,
          staffId: currentStaff.id,
          staffInitials: currentStaff.initials,
          staffName: currentStaff.name,
          date: appointment ? appointment.date : '2026-09-02',
          dayOfWeek: appointment ? appointment.dayOfWeek : 'MER 2',
          startTime: appointment ? appointment.startTime : '08:00',
          durationFormatted: formatDurationHours(durationMinutes),
          durationMinutes: durationMinutes,
          cleaningMinutes: 0,
          feePercentage: 0,
          source: appointment ? appointment.source : 'DIRECT',
          status: 'confirmed',
          notes,
        };

        onSave(appToSave);
        onClose();
      };

      const handleSelectService = (srv) => {
        setServiceId(srv.id);
        if (srv.durationMinutes) {
          setDurationMinutes(srv.durationMinutes);
        }
        setIsServiceDropdownOpen(false);
        setServiceSearchQuery('');
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-black/40 backdrop-blur-[2px] overflow-y-auto">
          <div className="relative w-full max-w-4xl bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col max-h-[94vh] animate-in fade-in zoom-in-95 duration-150">
            {/* Modal Title Header */}
            <div className="px-6 sm:px-8 py-4 border-b border-gray-100 flex items-center justify-between bg-white z-10">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3.5 py-1.5 bg-blue-50 text-tw-blue rounded-xl text-xs sm:text-sm font-bold uppercase tracking-wide">
                  <Icons.Calendar className="w-4 h-4" />
                  {appointment
                    ? (appointment.dayOfWeek + ' - ' + appointment.startTime)
                    : 'MER 2 - 08:00'}
                </div>
                <span className="text-xs sm:text-sm font-bold text-gray-700 hidden sm:inline">
                  {appointment ? 'Dettagli Appuntamento' : 'Nuovo Appuntamento'}
                </span>
              </div>

              <button
                onClick={onClose}
                className="p-2 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition cursor-pointer"
                title="Chiudi"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Scrollable Body */}
            <div className="p-6 sm:p-8 space-y-6 overflow-y-auto flex-1">
              {/* 1. Client Card */}
              <div className="bg-gray-50/70 rounded-2xl p-5 border border-gray-100 space-y-4">
                <div className="text-xs font-bold text-gray-500 uppercase tracking-wider flex items-center justify-between">
                  <span>DATI CLIENTE</span>
                  <span className="text-xs text-gray-400 font-normal">Scheda rapida cliente</span>
                </div>

                {/* Client Name Field */}
                <div className="relative flex items-center">
                  <input
                    type="text"
                    value={clientName}
                    onChange={(e) => setClientName(e.target.value)}
                    placeholder="Nome e cognome cliente..."
                    className="w-full bg-white border border-gray-200 rounded-xl px-4 py-3 text-sm font-semibold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue pr-24 shadow-xs"
                  />
                  <div className="absolute right-3.5 flex items-center gap-2 text-gray-400">
                    <button
                      type="button"
                      onClick={() => alert('Scheda cliente: ' + (clientName || 'Nuovo'))}
                      className="hover:text-tw-blue p-1.5 rounded-lg hover:bg-blue-50 transition"
                      title="Scheda cliente"
                    >
                      <Icons.Info className="w-4 h-4 text-tw-blue" />
                    </button>
                    <button
                      type="button"
                      onClick={() => alert('Storico visite: ' + (clientName || 'Cliente'))}
                      className="relative hover:text-tw-blue p-1.5 rounded-lg hover:bg-blue-50 transition"
                      title="Storico visite"
                    >
                      <Icons.ListFilter className="w-4 h-4" />
                      <span className="absolute top-0 right-0 w-3.5 h-3.5 bg-red-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
                        1
                      </span>
                    </button>
                  </div>
                </div>

                {/* Phone & Email Row */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-bold uppercase text-gray-500 mb-1.5">
                      Telefono
                    </label>
                    <input
                      type="text"
                      value={clientPhone}
                      onChange={(e) => setClientPhone(e.target.value)}
                      placeholder="+39 347 0000000"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs"
                    />
                  </div>

                  <div>
                    <div className="flex items-center justify-between mb-1.5">
                      <label className="block text-xs font-bold uppercase text-gray-500">
                        Email
                      </label>
                      <span className="text-[10px] font-bold text-emerald-600 tracking-wider">
                        PER RECENSIONI
                      </span>
                    </div>
                    <input
                      type="email"
                      value={clientEmail}
                      onChange={(e) => setClientEmail(e.target.value)}
                      placeholder="cliente@email.it"
                      className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm text-gray-700 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs"
                    />
                  </div>
                </div>

                {/* Quick Client Icons */}
                <div className="flex items-center justify-center gap-8 pt-1 text-gray-400 border-t border-gray-200/60">
                  <button type="button" className="hover:text-red-500 transition p-1.5 hover:scale-110" title="Cliente preferito">
                    <Icons.Heart className="w-5 h-5" />
                  </button>
                  <button type="button" className="hover:text-amber-500 transition p-1.5 hover:scale-110" title="Livello soddisfazione">
                    <Icons.Smile className="w-5 h-5" />
                  </button>
                  <button type="button" className="hover:text-blue-500 transition p-1.5 hover:scale-110" title="Puntualità cliente">
                    <Icons.Clock className="w-5 h-5" />
                  </button>
                  <span className="text-gray-300">•</span>
                  <button type="button" className="hover:text-pink-500 transition p-1.5 hover:scale-110" title="Compleanno cliente">
                    <Icons.Cake className="w-5 h-5" />
                  </button>
                  <button type="button" className="hover:text-indigo-500 transition p-1.5 hover:scale-110" title="Note tecniche salvate">
                    <Icons.FileText className="w-5 h-5" />
                  </button>
                </div>
              </div>

              {/* 2. Service & Treatment Selection Card */}
              <div className="border border-gray-200 rounded-3xl p-5 sm:p-6 space-y-5 bg-white shadow-xs">
                <div className="flex items-center justify-between pb-2 border-b border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <span className="text-sm font-bold uppercase tracking-wider text-gray-800 flex items-center gap-2">
                      <Icons.Scissors className="w-4 h-4 text-tw-blue" />
                      Trattamento Selezionato
                    </span>
                    <span className="text-xs text-gray-500 bg-gray-100 px-2.5 py-0.5 rounded-lg font-mono font-semibold">
                      {services.length} trattamenti disponibili
                    </span>
                  </div>
                  <div className="text-sm font-mono font-bold text-tw-blue bg-blue-50 px-3 py-1 rounded-full">
                    {(appointment?.startTime || '08:00')} ({formatDurationHours(durationMinutes)})
                  </div>
                </div>

                {/* Custom Searchable Dropdown */}
                <div className="relative" ref={dropdownRef}>
                  <div className="flex items-center justify-between mb-2">
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                      Trattamento Principale
                    </label>
                    <span className="text-xs text-tw-blue font-semibold">
                      Clicca per cercare o cambiare trattamento
                    </span>
                  </div>

                  {/* Dropdown Trigger Card */}
                  <button
                    type="button"
                    onClick={() => setIsServiceDropdownOpen(prev => !prev)}
                    className={'w-full flex items-center justify-between p-4 sm:p-5 rounded-2xl border text-left transition shadow-xs cursor-pointer ' +
                      (isServiceDropdownOpen
                        ? 'border-tw-blue ring-4 ring-tw-blue/15 bg-blue-50/20'
                        : 'border-gray-200 hover:border-tw-blue/80 hover:bg-gray-50/50 bg-white')
                    }
                  >
                    <div className="flex items-center gap-4 min-w-0 flex-1 mr-3">
                      <span
                        className="w-12 h-12 rounded-2xl text-sm font-black text-white flex items-center justify-center shrink-0 shadow-sm uppercase tracking-wide"
                        style={{ backgroundColor: currentService.categoryColor || '#8B5CF6' }}
                      >
                        {currentService.shortname || 'TU'}
                      </span>
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2.5 flex-wrap">
                          <span className="font-extrabold text-base sm:text-lg text-gray-900 truncate">
                            {currentService.name}
                          </span>
                          <span
                            className="text-[10px] sm:text-xs font-bold px-2.5 py-1 rounded-lg uppercase tracking-wide"
                            style={{
                              backgroundColor: (currentService.categoryColor || '#8B5CF6') + '18',
                              color: currentService.categoryColor || '#8B5CF6',
                            }}
                          >
                            {currentService.category}
                          </span>
                        </div>
                        <div className="text-xs sm:text-sm text-gray-600 flex items-center gap-3 pt-1">
                          <span>
                            Durata: <strong>{currentService.duration}</strong> ({durationMinutes}m)
                          </span>
                          <span>•</span>
                          <span className="font-bold text-gray-900 text-sm sm:text-base">
                            €{Number(currentService.price).toFixed(2)}
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2.5 text-gray-400 shrink-0">
                      <span className="text-xs sm:text-sm font-semibold text-gray-500 hidden sm:inline">
                        Cambia
                      </span>
                      <Icons.ChevronDown
                        className={'w-5 h-5 transition-transform duration-200 ' +
                          (isServiceDropdownOpen ? 'rotate-180 text-tw-blue' : '')
                        }
                      />
                    </div>
                  </button>

                  {/* Searchable Overlay Menu */}
                  {isServiceDropdownOpen && (
                    <div className="absolute top-full left-0 right-0 mt-2 bg-white rounded-2xl shadow-2xl border border-gray-200 z-50 overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150">
                      {/* Search Bar */}
                      <div className="p-3.5 border-b border-gray-100 bg-gray-50/80">
                        <div className="relative flex items-center">
                          <Icons.Search className="w-5 h-5 text-gray-400 absolute left-3.5" />
                          <input
                            ref={searchInputRef}
                            type="text"
                            value={serviceSearchQuery}
                            onChange={(e) => setServiceSearchQuery(e.target.value)}
                            placeholder="Cerca trattamento (es. Taglio, Barba, Colore, Piega, Spa)..."
                            className="w-full bg-white border border-gray-200 rounded-xl pl-11 pr-10 py-2.5 text-sm font-semibold text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue"
                          />
                          {serviceSearchQuery && (
                            <button
                              type="button"
                              onClick={() => setServiceSearchQuery('')}
                              className="absolute right-3 p-1 text-gray-400 hover:text-gray-600 rounded-md"
                            >
                              <Icons.X className="w-4 h-4" />
                            </button>
                          )}
                        </div>

                        {/* Category Filter Pills */}
                        <div className="flex items-center gap-1.5 overflow-x-auto pt-2.5 pb-0.5 no-scrollbar">
                          {categories.map(cat => (
                            <button
                              key={cat}
                              type="button"
                              onClick={() => setSelectedCategoryFilter(cat)}
                              className={'text-xs font-bold px-3 py-1.5 rounded-xl shrink-0 transition cursor-pointer ' +
                                (selectedCategoryFilter === cat
                                  ? 'bg-tw-blue text-white shadow-xs'
                                  : 'bg-white text-gray-700 hover:bg-gray-200/70 border border-gray-200/80')
                              }
                            >
                              {cat}
                            </button>
                          ))}
                        </div>
                      </div>

                      {/* Filtered Services List */}
                      <div className="max-h-80 overflow-y-auto divide-y divide-gray-100">
                        {filteredServices.length === 0 ? (
                          <div className="p-8 text-center text-sm text-gray-500">
                            Nessun trattamento trovato per "{serviceSearchQuery}"
                            <button
                              type="button"
                              onClick={() => {
                                setServiceSearchQuery('');
                                setSelectedCategoryFilter('TUTTI');
                              }}
                              className="block mx-auto mt-2 text-tw-blue hover:underline font-bold"
                            >
                              Mostra tutti i 40 trattamenti
                            </button>
                          </div>
                        ) : (
                          filteredServices.map(srv => {
                            const isSelected = srv.id === currentService.id;
                            return (
                              <div
                                key={srv.id}
                                onClick={() => handleSelectService(srv)}
                                className={'p-4 flex items-center justify-between cursor-pointer transition ' +
                                  (isSelected ? 'bg-blue-50/80 border-l-4 border-tw-blue' : 'hover:bg-gray-50')
                                }
                              >
                                <div className="flex items-center gap-3.5 min-w-0 mr-3">
                                  <span
                                    className="w-10 h-10 rounded-xl text-xs font-black text-white flex items-center justify-center shrink-0 uppercase shadow-xs tracking-wide"
                                    style={{ backgroundColor: srv.categoryColor }}
                                  >
                                    {srv.shortname}
                                  </span>
                                  <div className="min-w-0">
                                    <div className="text-sm sm:text-base font-bold text-gray-900 truncate">
                                      {srv.name}
                                    </div>
                                    <div className="flex items-center gap-2.5 text-xs text-gray-500 pt-0.5">
                                      <span className="font-bold uppercase tracking-wider" style={{ color: srv.categoryColor }}>
                                        {srv.category}
                                      </span>
                                      <span>•</span>
                                      <span>{srv.duration} ({srv.durationMinutes} min)</span>
                                    </div>
                                  </div>
                                </div>

                                <div className="flex items-center gap-3 shrink-0">
                                  <span className="text-sm sm:text-base font-extrabold text-gray-900 bg-gray-100 px-3 py-1 rounded-xl">
                                    €{Number(srv.price).toFixed(2)}
                                  </span>
                                  {isSelected && (
                                    <Icons.Check className="w-5 h-5 text-tw-blue shrink-0" />
                                  )}
                                </div>
                              </div>
                            );
                          })
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Duration & Staff Selection */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-1">
                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Durata Appuntamento
                    </label>
                    <div className="relative">
                      <select
                        value={durationMinutes}
                        onChange={(e) => setDurationMinutes(Number(e.target.value))}
                        className="w-full text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer appearance-none shadow-xs pr-9"
                      >
                        {DURATION_STEPS.map(min => (
                          <option key={min} value={min}>
                            {formatDurationHours(min)} ({min} min)
                          </option>
                        ))}
                      </select>
                      <Icons.ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1.5">
                      Collaboratore (CON)
                    </label>
                    <div className="relative">
                      <select
                        value={staffId}
                        onChange={(e) => setStaffId(e.target.value)}
                        className="w-full text-sm font-bold text-gray-800 bg-gray-50 border border-gray-200 rounded-xl pl-10 pr-9 py-2.5 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer appearance-none shadow-xs"
                      >
                        {staffList.map(st => (
                          <option key={st.id} value={st.id}>
                            {st.name} ({st.role})
                          </option>
                        ))}
                      </select>
                      <Icons.Armchair className="w-4 h-4 text-gray-400 absolute left-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                      <Icons.ChevronDown className="w-4 h-4 text-gray-400 absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                    </div>
                  </div>
                </div>

                {/* Notes */}
                <div className="space-y-1.5 pt-1">
                  <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                    Note Tecniche Appuntamento
                  </label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Note tecniche, formule di colore, dettagli cliente..."
                    rows={3}
                    className="w-full text-sm p-3.5 border border-gray-200 rounded-xl text-gray-700 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs resize-none"
                  />
                </div>

                {/* Summary Info */}
                <div className="flex items-center justify-between text-xs text-gray-500 font-medium pt-3 border-t border-gray-100">
                  <div className="flex items-center gap-3">
                    <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-bold">FEE 0%</span>
                    <span className="bg-gray-100 px-2.5 py-1 rounded-md text-gray-700 font-bold">FONTE DIRECT</span>
                  </div>
                  <div className="text-right">
                    <span className="text-gray-500 mr-1.5 text-xs">Importo stimato:</span>
                    <span className="font-extrabold text-gray-900 text-sm sm:text-base">
                      €{Number(currentService.price).toFixed(2)}
                    </span>
                  </div>
                </div>
              </div>

              {/* 3. Footer Buttons: ONLY Salva Appuntamento */}
              <div className="flex items-center justify-between pt-3 border-t border-gray-100">
                <div className="flex items-center gap-2.5">
                  <button
                    type="button"
                    onClick={() => {
                      if (appointment && confirm('Sei sicuro di voler eliminare questo appuntamento?')) {
                        onDelete(appointment.id);
                        onClose();
                      }
                    }}
                    className="p-2.5 hover:bg-red-50 text-gray-400 hover:text-red-500 rounded-xl border border-gray-200 transition cursor-pointer"
                    title="Elimina appuntamento"
                  >
                    <Icons.Trash2 className="w-4 h-4" />
                  </button>
                  <button
                    type="button"
                    onClick={() => window.print()}
                    className="p-2.5 hover:bg-gray-100 text-gray-500 rounded-xl border border-gray-200 transition cursor-pointer"
                    title="Stampa scheda"
                  >
                    <Icons.Printer className="w-4 h-4" />
                  </button>
                </div>

                {/* Only Salva Appuntamento Button */}
                <button
                  type="button"
                  onClick={handleSaveClick}
                  className="px-6 py-2.5 rounded-xl bg-tw-blue hover:bg-tw-blue-hover text-white text-sm font-bold flex items-center gap-2 shadow-sm transition cursor-pointer"
                  title="Salva e conferma appuntamento"
                >
                  <Icons.Check className="w-4 h-4" />
                  <span>Salva Appuntamento</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- DAY SCHEDULE MODAL (Direct day override from Agenda) ---
    function DayScheduleDialog({
      isOpen,
      onClose,
      day,
      onSave,
      onResetOverride,
    }) {
      const [isOpenDay, setIsOpenDay] = useState(true);
      const [openTime, setOpenTime] = useState('07:00');
      const [closeTime, setCloseTime] = useState('20:00');
      const [applyToAllMatchingDays, setApplyToAllMatchingDays] = useState(false);

      const TIME_OPTIONS = [
        '06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
        '10:00', '10:30', '11:00', '11:30', '12:00', '12:30', '13:00', '13:30',
        '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30',
        '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00',
      ];

      const fullDayNames = {
        LUN: 'Lunedì',
        MAR: 'Martedì',
        MER: 'Mercoledì',
        GIO: 'Giovedì',
        VEN: 'Venerdì',
        SAB: 'Sabato',
        DOM: 'Domenica',
      };

      useEffect(() => {
        if (day) {
          setIsOpenDay(!day.isClosed);
          setOpenTime(day.openTime || '07:00');
          setCloseTime(day.closeTime || '20:00');
          setApplyToAllMatchingDays(false);
        }
      }, [day, isOpen]);

      if (!isOpen || !day) return null;

      const fullDayName = fullDayNames[day.name] || day.name;

      const handleApplyPreset = (open, close) => {
        setIsOpenDay(true);
        setOpenTime(open);
        setCloseTime(close);
      };

      const handleSave = () => {
        onSave({
          dayKey: day.key,
          dayName: day.name,
          isOpen: isOpenDay,
          openTime,
          closeTime,
          applyToAllMatchingDays,
        });
        onClose();
      };

      const handleReset = () => {
        if (onResetOverride) {
          onResetOverride(day.key);
          onClose();
        }
      };

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="relative w-full max-w-lg bg-white rounded-3xl shadow-2xl overflow-hidden border border-gray-100 flex flex-col animate-in fade-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between bg-white">
              <div className="flex items-center gap-3">
                <div className="flex items-center gap-2 px-3 py-1 bg-blue-50 text-tw-blue rounded-xl text-xs font-bold uppercase tracking-wide">
                  <Icons.Clock className="w-4 h-4" />
                  <span>{day.key}</span>
                </div>
                <div>
                  <h2 className="text-sm font-bold text-gray-800">
                    Orari e Disponibilità
                  </h2>
                  <p className="text-[11px] text-gray-500">
                    {fullDayName} {day.date} Settembre 2026
                  </p>
                </div>
              </div>

              <button
                onClick={onClose}
                className="p-1.5 hover:bg-gray-100 text-gray-400 hover:text-gray-700 rounded-xl transition cursor-pointer"
                title="Chiudi"
              >
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-6 space-y-5 overflow-y-auto max-h-[80vh]">
              {/* Status Switcher: Aperto vs Chiuso */}
              <div className="space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Stato del Salone per {fullDayName} {day.date}
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    type="button"
                    onClick={() => setIsOpenDay(true)}
                    className={'py-3 px-4 rounded-2xl border-2 flex items-center justify-center gap-2.5 transition font-bold text-sm cursor-pointer ' +
                      (isOpenDay
                        ? 'border-emerald-500 bg-emerald-50/50 text-emerald-700 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                    }
                  >
                    <div className={'w-3 h-3 rounded-full ' + (isOpenDay ? 'bg-emerald-500' : 'bg-gray-300')} />
                    <span>APERTO</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setIsOpenDay(false)}
                    className={'py-3 px-4 rounded-2xl border-2 flex items-center justify-center gap-2.5 transition font-bold text-sm cursor-pointer ' +
                      (!isOpenDay
                        ? 'border-rose-500 bg-rose-50/50 text-rose-700 shadow-xs'
                        : 'border-gray-200 bg-white text-gray-600 hover:bg-gray-50')
                    }
                  >
                    <div className={'w-3 h-3 rounded-full ' + (!isOpenDay ? 'bg-rose-500' : 'bg-gray-300')} />
                    <span>CHIUSO</span>
                  </button>
                </div>
              </div>

              {/* If Aperto: Opening & Closing Hours */}
              {isOpenDay ? (
                <div className="space-y-4 border border-gray-100 rounded-2xl p-4 bg-gray-50/50">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                        <Icons.Sun className="w-3.5 h-3.5 text-amber-500" />
                        Orario Apertura
                      </label>
                      <select
                        value={openTime}
                        onChange={(e) => setOpenTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs cursor-pointer"
                      >
                        {TIME_OPTIONS.filter((t) => t < closeTime).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>

                    <div className="space-y-1.5">
                      <label className="text-xs font-bold text-gray-600 uppercase flex items-center gap-1.5">
                        <Icons.Moon className="w-3.5 h-3.5 text-indigo-500" />
                        Orario Chiusura
                      </label>
                      <select
                        value={closeTime}
                        onChange={(e) => setCloseTime(e.target.value)}
                        className="w-full px-3.5 py-2.5 bg-white border border-gray-200 rounded-xl text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue shadow-xs cursor-pointer"
                      >
                        {TIME_OPTIONS.filter((t) => t > openTime).map((t) => (
                          <option key={t} value={t}>
                            {t}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Quick Presets */}
                  <div className="space-y-1.5 pt-1">
                    <span className="text-[11px] font-bold text-gray-400 uppercase tracking-wider">
                      Scorciatoie Orari
                    </span>
                    <div className="flex items-center gap-2 flex-wrap">
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('07:00', '20:00')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                      >
                        07:00 - 20:00
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('08:00', '19:00')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                      >
                        08:00 - 19:00
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('08:00', '13:00')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                      >
                        Solo Mattina (08-13)
                      </button>
                      <button
                        type="button"
                        onClick={() => handleApplyPreset('14:00', '20:00')}
                        className="px-2.5 py-1 text-xs font-semibold rounded-lg bg-white border border-gray-200 hover:border-tw-blue text-gray-700 hover:text-tw-blue transition cursor-pointer"
                      >
                        Pomeriggio (14-20)
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="p-4 bg-rose-50/70 border border-rose-200 rounded-2xl flex items-start gap-3 text-rose-800 text-xs">
                  <Icons.AlertTriangle className="w-4 h-4 text-rose-500 shrink-0 mt-0.5" />
                  <div>
                    <strong className="block font-bold">Giorno di chiusura straordinaria</strong>
                    <span>
                      L'agenda mostrerà l'intera colonna di {fullDayName} {day.date} tratteggiata (grigia) e non sarà possibile inserire nuovi appuntamenti in questo giorno.
                    </span>
                  </div>
                </div>
              )}

              {/* Scope Selector: Solo questo giorno vs Tutti i [Giorno] */}
              <div className="border-t border-gray-100 pt-4 space-y-2">
                <label className="block text-xs font-bold uppercase tracking-wider text-gray-500">
                  Ambito di applicazione
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="scheduleScope"
                      checked={!applyToAllMatchingDays}
                      onChange={() => setApplyToAllMatchingDays(false)}
                      className="w-4 h-4 text-tw-blue focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-gray-800 block">
                        Modifica forzata solo per {day.key} ({day.date} Settembre)
                      </span>
                      <span className="text-gray-500">
                        Apertura o chiusura straordinaria limitata a questa data specifica.
                      </span>
                    </div>
                  </label>

                  <label className="flex items-center gap-3 p-3 rounded-xl border border-gray-200 hover:bg-gray-50 cursor-pointer transition">
                    <input
                      type="radio"
                      name="scheduleScope"
                      checked={applyToAllMatchingDays}
                      onChange={() => setApplyToAllMatchingDays(true)}
                      className="w-4 h-4 text-tw-blue focus:ring-0"
                    />
                    <div className="text-xs">
                      <span className="font-bold text-gray-800 block">
                        Aggiorna l'orario standard di tutti i {fullDayName}
                      </span>
                      <span className="text-gray-500">
                        Modifica permanente nella tabella orari generali del salone.
                      </span>
                    </div>
                  </label>
                </div>
              </div>
            </div>

            {/* Footer Actions */}
            <div className="px-6 py-4 border-t border-gray-100 bg-gray-50/70 flex items-center justify-between">
              <div>
                {day.isOverridden && onResetOverride && (
                  <button
                    type="button"
                    onClick={handleReset}
                    className="px-3.5 py-2 text-xs font-bold text-amber-700 bg-amber-50 hover:bg-amber-100 rounded-xl border border-amber-200 flex items-center gap-1.5 transition cursor-pointer"
                    title="Ripristina l'orario ordinario per questo giorno"
                  >
                    <Icons.RotateCcw className="w-3.5 h-3.5" />
                    <span>Ripristina Standard</span>
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-200/70 rounded-xl transition cursor-pointer"
                >
                  Annulla
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="px-5 py-2 text-xs font-bold bg-tw-blue hover:bg-tw-blue-hover text-white rounded-xl shadow-xs flex items-center gap-2 transition cursor-pointer"
                >
                  <Icons.Check className="w-4 h-4" />
                  <span>Salva Orari Giorno</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      );
    }

    // --- ORARI STANDALONE VIEW (Sincronizzato con l'Agenda) ---
    function OrariStandaloneView({ salonHours, onUpdateSalonHours, onBack, showToast }) {
      const [activeTab, setActiveTab] = useState('orari');
      const [selectedDayIndex, setSelectedDayIndex] = useState(2); // Mercoledì
      const [extraOpenings, setExtraOpenings] = useState([
        { id: '1', date: '2026-12-20', title: 'Apertura Domenicale Natale', hours: '09:00 - 18:00' },
      ]);
      const [extraClosures, setExtraClosures] = useState([
        { id: '1', date: '2026-08-15', title: 'Ferragosto', reason: 'Festa Nazionale' },
        { id: '2', date: '2026-12-25', title: 'Natale', reason: 'Festività' },
      ]);

      const selectedDay = salonHours[selectedDayIndex];

      const handleToggleDay = (idx, e) => {
        if (e) e.stopPropagation();
        const updated = salonHours.map((item, i) => {
          if (i === idx) {
            const nextOpen = !item.isOpen;
            return {
              ...item,
              isOpen: nextOpen,
              hours: nextOpen ? (item.openTime + ' - ' + item.closeTime) : 'Chiuso',
            };
          }
          return item;
        });
        onUpdateSalonHours(updated);
        showToast(salonHours[idx].day + (salonHours[idx].isOpen ? ' impostato come CHIUSO' : ' impostato come APERTO'));
      };

      const handleTimeChange = (type, value) => {
        const updated = salonHours.map((item, i) => {
          if (i === selectedDayIndex) {
            const newOpen = type === 'open' ? value : item.openTime;
            const newClose = type === 'close' ? value : item.closeTime;
            return {
              ...item,
              openTime: newOpen,
              closeTime: newClose,
              hours: item.isOpen ? (newOpen + ' - ' + newClose) : 'Chiuso',
            };
          }
          return item;
        });
        onUpdateSalonHours(updated);
        showToast('Orario ' + selectedDay.day + ' aggiornato: ' + (type === 'open' ? value : selectedDay.openTime) + ' - ' + (type === 'close' ? value : selectedDay.closeTime));
      };

      return (
        <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-none">
          {/* Subnavigation Bar */}
          <div className="bg-gray-50 border-b border-gray-200 px-6 py-2.5 flex items-center justify-between flex-shrink-0">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setActiveTab('orari')}
                className={'px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ' +
                  (activeTab === 'orari'
                    ? 'bg-tw-blue text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200')}
              >
                Orari Salone
              </button>
              <button
                onClick={() => setActiveTab('aperture')}
                className={'px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ' +
                  (activeTab === 'aperture'
                    ? 'bg-tw-blue text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200')}
              >
                Aperture Straordinarie
              </button>
              <button
                onClick={() => setActiveTab('chiusure')}
                className={'px-4 py-1.5 rounded-full text-xs font-semibold transition cursor-pointer ' +
                  (activeTab === 'chiusure'
                    ? 'bg-tw-blue text-white shadow-xs'
                    : 'bg-white text-gray-600 hover:bg-gray-200/70 border border-gray-200')}
              >
                Chiusure Straordinarie
              </button>
            </div>

            <div className="flex items-center gap-3">
              <span className="text-[11px] text-gray-400 font-medium hidden sm:inline">
                {activeTab === 'orari' && "Sincronizzato in tempo reale con l'agenda"}
                {activeTab === 'aperture' && (extraOpenings.length + ' aperture straordinarie')}
                {activeTab === 'chiusure' && (extraClosures.length + ' chiusure straordinarie')}
              </span>
              <button
                onClick={onBack}
                className="px-3 py-1 bg-tw-blue hover:bg-tw-blue-hover text-white rounded-lg text-xs font-bold transition cursor-pointer flex items-center gap-1"
              >
                <Icons.Calendar className="w-3.5 h-3.5" />
                <span>Vedi in Agenda</span>
              </button>
            </div>
          </div>

          {/* TAB 1: ORARI SALONE */}
          {activeTab === 'orari' && (
            <div className="flex-1 flex h-full overflow-hidden">
              {/* Days List Sidebar */}
              <div className="w-80 border-r border-gray-200 flex flex-col bg-white">
                <div className="p-3.5 bg-gray-50/50 border-b border-gray-100 text-[11px] font-bold text-gray-500 uppercase tracking-wider">
                  Giorni della settimana
                </div>
                <div className="divide-y divide-gray-100 flex-1 overflow-y-auto">
                  {salonHours.map((item, idx) => {
                    const isSelected = selectedDayIndex === idx;
                    return (
                      <div
                        key={item.day}
                        onClick={() => setSelectedDayIndex(idx)}
                        className={'p-4 flex items-center justify-between cursor-pointer transition ' +
                          (isSelected
                            ? 'bg-blue-50/80 border-l-4 border-tw-blue'
                            : 'hover:bg-gray-50 border-l-4 border-transparent')}
                      >
                        <div>
                          <div className={'font-bold text-xs ' + (isSelected ? 'text-tw-blue' : 'text-gray-800')}>
                            {item.day}
                          </div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{item.hours}</div>
                        </div>

                        <button
                          type="button"
                          onClick={(e) => handleToggleDay(idx, e)}
                          className={'w-11 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ' +
                            (item.isOpen ? 'bg-tw-blue justify-end' : 'bg-gray-300 justify-start')}
                        >
                          <span className="bg-white w-4 h-4 rounded-full shadow-md block transform transition-transform" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Day Config Panel */}
              <div className="flex-1 p-8 overflow-y-auto bg-gray-50/30">
                <div className="max-w-2xl bg-white border border-gray-200 rounded-3xl p-6 sm:p-8 shadow-xs space-y-6">
                  <div className="flex items-center justify-between border-b border-gray-100 pb-5">
                    <div>
                      <h2 className="text-xl font-black text-gray-900">{selectedDay.day}</h2>
                      <p className="text-xs text-gray-500 mt-0.5">
                        Configura gli orari standard di apertura per questo giorno
                      </p>
                    </div>

                    <div className="flex items-center gap-3">
                      <span className={'text-xs font-bold uppercase tracking-wider px-2.5 py-1 rounded-full ' +
                        (selectedDay.isOpen ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700')}>
                        {selectedDay.isOpen ? 'Aperto' : 'Chiuso'}
                      </span>
                      <button
                        type="button"
                        onClick={(e) => handleToggleDay(selectedDayIndex, e)}
                        className={'w-12 h-6 flex items-center rounded-full p-1 transition-colors duration-200 cursor-pointer ' +
                          (selectedDay.isOpen ? 'bg-tw-blue justify-end' : 'bg-gray-300 justify-start')}
                      >
                        <span className="bg-white w-4 h-4 rounded-full shadow-md block transform transition-transform" />
                      </button>
                    </div>
                  </div>

                  {selectedDay.isOpen ? (
                    <div className="space-y-5">
                      <div className="p-4 bg-blue-50/50 border border-blue-100 rounded-2xl flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <Icons.Clock className="w-5 h-5 text-tw-blue" />
                          <div>
                            <div className="text-xs font-bold text-gray-800">Orario Continuato</div>
                            <div className="text-[11px] text-gray-500 font-mono">{selectedDay.openTime} - {selectedDay.closeTime}</div>
                          </div>
                        </div>
                      </div>

                      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 flex items-center gap-1.5">
                            <Icons.Sun className="w-3.5 h-3.5 text-amber-500" />
                            Apertura
                          </label>
                          <select
                            value={selectedDay.openTime}
                            onChange={(e) => handleTimeChange('open', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer"
                          >
                            {['06:00', '06:30', '07:00', '07:30', '08:00', '08:30', '09:00', '09:30', '10:00', '10:30', '11:00', '11:30', '12:00']
                              .map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                          </select>
                        </div>

                        <div>
                          <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5 flex items-center gap-1.5">
                            <Icons.Moon className="w-3.5 h-3.5 text-indigo-500" />
                            Chiusura
                          </label>
                          <select
                            value={selectedDay.closeTime}
                            onChange={(e) => handleTimeChange('close', e.target.value)}
                            className="w-full bg-white border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-mono font-bold text-gray-800 focus:outline-none focus:ring-2 focus:ring-tw-blue/30 focus:border-tw-blue cursor-pointer"
                          >
                            {['13:00', '13:30', '14:00', '14:30', '15:00', '15:30', '16:00', '16:30', '17:00', '17:30', '18:00', '18:30', '19:00', '19:30', '20:00', '20:30', '21:00', '21:30', '22:00']
                              .map(t => (
                                <option key={t} value={t}>{t}</option>
                              ))}
                          </select>
                        </div>
                      </div>

                      <div className="pt-2 flex items-center gap-2 text-xs text-gray-500">
                        <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span>Le modifiche si applicano automaticamente alle colonne dell'Agenda</span>
                      </div>
                    </div>
                  ) : (
                    <div className="p-6 bg-gray-50 border border-gray-200 rounded-2xl text-center space-y-2">
                      <div className="w-10 h-10 mx-auto rounded-full bg-rose-100 text-rose-600 flex items-center justify-center">
                        <Icons.AlertTriangle className="w-5 h-5" />
                      </div>
                      <div className="font-bold text-sm text-gray-800">Giorno impostato come CHIUSO</div>
                      <p className="text-xs text-gray-500 max-w-sm mx-auto">
                        In questo giorno il salone resterà chiuso. L'agenda mostrerà la colonna di {selectedDay.day} con sfondo tratteggiato e bloccherà le prenotazioni.
                      </p>
                      <button
                        type="button"
                        onClick={(e) => handleToggleDay(selectedDayIndex, e)}
                        className="mt-3 px-4 py-2 bg-tw-blue text-white rounded-xl text-xs font-bold hover:bg-tw-blue-hover transition cursor-pointer"
                      >
                        Riapri {selectedDay.day}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* TAB 2: APERTURE STRAORDINARIE */}
          {activeTab === 'aperture' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Aperture Straordinarie</h3>
                    <p className="text-xs text-gray-500">Date speciali in cui il salone effettua aperture non ordinarie</p>
                  </div>
                  <button
                    onClick={() => {
                      const newOpening = {
                        id: 'ext-' + Date.now(),
                        date: '2026-12-27',
                        title: 'Apertura Straordinaria Domenicale',
                        hours: '09:00 - 19:00',
                      };
                      setExtraOpenings(prev => [...prev, newOpening]);
                      showToast('Apertura straordinaria aggiunta!');
                    }}
                    className="px-4 py-2 bg-tw-blue hover:bg-tw-blue-hover text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Icons.Plus className="w-4 h-4" />
                    <span>Aggiungi Apertura</span>
                  </button>
                </div>

                <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                  {extraOpenings.map(op => (
                    <div key={op.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-blue-50 text-tw-blue flex items-center justify-center font-bold text-xs">
                          <Icons.Calendar className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-gray-800">{op.title}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{op.date} • {op.hours}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setExtraOpenings(prev => prev.filter(x => x.id !== op.id));
                          showToast('Apertura rimossa');
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Elimina"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* TAB 3: CHIUSURE STRAORDINARIE */}
          {activeTab === 'chiusure' && (
            <div className="flex-1 p-8 overflow-y-auto">
              <div className="max-w-3xl mx-auto space-y-6">
                <div className="flex items-center justify-between">
                  <div>
                    <h3 className="text-lg font-bold text-gray-800">Chiusure Straordinarie e Festività</h3>
                    <p className="text-xs text-gray-500">Giorni in cui il salone rimarrà chiuso oltre ai turni standard</p>
                  </div>
                  <button
                    onClick={() => {
                      const newClosure = {
                        id: 'cls-' + Date.now(),
                        date: '2026-11-01',
                        title: 'Tutti i Santi',
                        reason: 'Festività Nazionale',
                      };
                      setExtraClosures(prev => [...prev, newClosure]);
                      showToast('Chiusura straordinaria aggiunta!');
                    }}
                    className="px-4 py-2 bg-rose-600 hover:bg-rose-700 text-white text-xs font-bold rounded-xl flex items-center gap-1.5 shadow-xs transition cursor-pointer"
                  >
                    <Icons.Plus className="w-4 h-4" />
                    <span>Aggiungi Chiusura</span>
                  </button>
                </div>

                <div className="divide-y divide-gray-100 bg-white border border-gray-200 rounded-2xl overflow-hidden shadow-xs">
                  {extraClosures.map(cl => (
                    <div key={cl.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-rose-50 text-rose-600 flex items-center justify-center font-bold text-xs">
                          <Icons.AlertTriangle className="w-5 h-5" />
                        </div>
                        <div>
                          <div className="font-bold text-xs text-gray-800">{cl.title}</div>
                          <div className="text-[11px] text-gray-400 font-mono mt-0.5">{cl.date} • {cl.reason}</div>
                        </div>
                      </div>
                      <button
                        onClick={() => {
                          setExtraClosures(prev => prev.filter(x => x.id !== cl.id));
                          showToast('Chiusura rimossa');
                        }}
                        className="p-2 text-gray-400 hover:text-red-500 rounded-lg hover:bg-red-50 transition cursor-pointer"
                        title="Elimina"
                      >
                        <Icons.Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
        </div>
      );
    }

    // --- DAY OVERVIEW MODAL ---
    function DayOverviewDialog({ isOpen, onClose, appointments, onOpenFlashPromo }) {
      const [activeTab, setActiveTab] = useState('incassi');

      if (!isOpen) return null;

      const totalRevenue = appointments.reduce((sum, a) => {
        const srv = RAW_SERVICES.find(s => s.id === a.serviceId);
        return sum + (srv ? Number(srv.price) : 30);
      }, 0);

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="relative w-full max-w-4xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="relative px-8 py-5 border-b border-gray-100 flex items-center justify-center">
              <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
                PANORAMICA DEL GIORNO
              </h2>
              <div className="absolute right-6 flex items-center gap-3 text-gray-500">
                <button onClick={() => window.print()} className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Stampa">
                  <Icons.Printer className="w-4 h-4" />
                </button>
                <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition" title="Chiudi">
                  <Icons.X className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Tabs */}
            <div className="flex justify-center border-b border-gray-100 text-xs font-semibold">
              <button
                onClick={() => setActiveTab('incassi')}
                className={'px-6 py-3 border-b-2 transition ' +
                  (activeTab === 'incassi' ? 'border-tw-blue text-tw-blue' : 'border-transparent text-gray-500 hover:text-gray-800')}
              >
                INCASSI PREVISTI
              </button>
              <button
                onClick={() => setActiveTab('lista')}
                className={'px-6 py-3 border-b-2 transition flex items-center gap-1.5 ' +
                  (activeTab === 'lista' ? 'border-tw-blue text-tw-blue' : 'border-transparent text-gray-500 hover:text-gray-800')}
              >
                <span>LISTA APPUNTAMENTI</span>
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] flex items-center justify-center">
                  {appointments.length}
                </span>
              </button>
              <button
                onClick={() => setActiveTab('disdette')}
                className={'px-6 py-3 border-b-2 transition flex items-center gap-1.5 ' +
                  (activeTab === 'disdette' ? 'border-tw-blue text-tw-blue' : 'border-transparent text-gray-500 hover:text-gray-800')}
              >
                <span>DISDETTE E NO-SHOWS</span>
                <span className="w-4 h-4 rounded-full bg-gray-200 text-gray-700 text-[10px] flex items-center justify-center">
                  0
                </span>
              </button>
            </div>

            {/* Tab Body */}
            <div className="p-8 max-h-[60vh] overflow-y-auto">
              {activeTab === 'incassi' && (
                <div className="space-y-6">
                  <div className="bg-blue-50/50 rounded-2xl p-6 border border-blue-100 text-center">
                    <div className="text-xs font-bold text-tw-blue uppercase tracking-wider mb-1">
                      TOTALE INCASSI PREVISTI (OGGI)
                    </div>
                    <div className="text-4xl font-black text-gray-900">
                      €{totalRevenue.toFixed(2)}
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Basato su {appointments.length} appuntamenti confermati
                    </div>
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="text-xs font-bold text-gray-700">Gianluca Tadonio (Titolare)</div>
                      <div className="text-2xl font-black text-gray-900 mt-1">
                        €{appointments.filter(a => a.staffInitials === 'GI').reduce((s, a) => {
                          const srv = RAW_SERVICES.find(srv => srv.id === a.serviceId);
                          return s + (srv ? Number(srv.price) : 30);
                        }, 0).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {appointments.filter(a => a.staffInitials === 'GI').length} appuntamenti
                      </div>
                    </div>

                    <div className="border border-gray-100 rounded-xl p-4 bg-gray-50/50">
                      <div className="text-xs font-bold text-gray-700">Sara Bianchi (Collaboratore)</div>
                      <div className="text-2xl font-black text-gray-900 mt-1">
                        €{appointments.filter(a => a.staffInitials === 'SA').reduce((s, a) => {
                          const srv = RAW_SERVICES.find(srv => srv.id === a.serviceId);
                          return s + (srv ? Number(srv.price) : 10);
                        }, 0).toFixed(2)}
                      </div>
                      <div className="text-[11px] text-gray-500 mt-0.5">
                        {appointments.filter(a => a.staffInitials === 'SA').length} appuntamenti
                      </div>
                    </div>
                  </div>
                </div>
              )}

              {activeTab === 'lista' && (
                <div className="divide-y divide-gray-100">
                  {appointments.map(app => (
                    <div key={app.id} className="py-3 flex items-center justify-between">
                      <div className="flex items-center gap-3">
                        <span className="font-mono text-xs font-bold text-tw-blue bg-blue-50 px-2.5 py-1 rounded-lg">
                          {app.startTime}
                        </span>
                        <div>
                          <div className="text-sm font-bold text-gray-900">{app.clientName}</div>
                          <div className="text-xs text-gray-500">{app.serviceName} • {app.staffName} ({app.dayOfWeek})</div>
                        </div>
                      </div>
                      <div className="font-extrabold text-sm text-gray-900">
                        €{RAW_SERVICES.find(s => s.id === app.serviceId)?.price?.toFixed(2) || '30.00'}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {activeTab === 'disdette' && (
                <div className="p-8 text-center text-gray-500 text-sm">
                  Nessuna disdetta o no-show registrata oggi.
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="px-8 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
              <button
                onClick={onOpenFlashPromo}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-600 text-white text-xs font-bold rounded-xl flex items-center gap-2 transition"
              >
                <Icons.Zap className="w-4 h-4" />
                <span>Riempi Buchi con Promo Flash</span>
              </button>
              <button
                onClick={onClose}
                className="px-5 py-2 bg-gray-200 hover:bg-gray-300 text-gray-700 text-xs font-bold rounded-xl transition"
              >
                Chiudi
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- FLASH PROMO MODAL ---
    function FlashPromoDialog({ isOpen, onClose, onSavePromo }) {
      const [discount, setDiscount] = useState('-20%');
      const [duration, setDuration] = useState('Prossime 3 ore');

      if (!isOpen) return null;

      return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
          <div className="relative w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 border border-gray-100 space-y-5 animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="p-2 bg-amber-100 text-amber-600 rounded-xl">
                  <Icons.Zap className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">Promo Flash Salone</h3>
                  <p className="text-xs text-gray-500">Riempi gli slot vuoti in agenda</p>
                </div>
              </div>
              <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg">
                <Icons.X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Sconto Applicato</label>
                <div className="grid grid-cols-3 gap-2">
                  {['-20%', '-30%', '-50%'].map(disc => (
                    <button
                      key={disc}
                      type="button"
                      onClick={() => setDiscount(disc)}
                      className={'py-2.5 rounded-xl font-bold text-sm border transition ' +
                        (discount === disc ? 'bg-amber-500 text-white border-amber-500 shadow-sm' : 'bg-gray-50 text-gray-700 border-gray-200 hover:bg-gray-100')}
                    >
                      {disc}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold text-gray-600 uppercase mb-1.5">Validità</label>
                <select
                  value={duration}
                  onChange={(e) => setDuration(e.target.value)}
                  className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-medium text-gray-700 focus:outline-none"
                >
                  <option value="Prossime 2 ore">Prossime 2 ore</option>
                  <option value="Prossime 3 ore">Prossime 3 ore</option>
                  <option value="Tutto il pomeriggio">Tutto il pomeriggio</option>
                  <option value="Fino a chiusura">Fino a chiusura</option>
                </select>
              </div>
            </div>

            <div className="pt-2 flex items-center justify-end gap-2.5">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-100 rounded-xl transition"
              >
                Annulla
              </button>
              <button
                type="button"
                onClick={() => onSavePromo({ discount, duration })}
                className="px-5 py-2 text-xs font-bold bg-amber-500 hover:bg-amber-600 text-white rounded-xl shadow-sm transition"
              >
                Attiva Promo Ora
              </button>
            </div>
          </div>
        </div>
      );
    }

    // --- SLIDE DRAWER MENU ---
    function SlideDrawer({ isOpen, onClose, currentSection, onSelectSection, onOpenDayOverview, onOpenFlashPromo, showToast }) {
      if (!isOpen) return null;

      const menuItems = [
        { id: 'agenda', label: 'AGENDA', icon: Icons.Calendar },
        { id: 'orari', label: 'ORARI', icon: Icons.Clock },
        { id: 'cassa', label: 'CASSA', icon: Icons.CreditCard },
        { id: 'rubrica', label: 'RUBRICA', icon: Icons.BookUser },
        { id: 'promozioni', label: 'PROMOZIONI', icon: Icons.Tag },
        { id: 'masterclass', label: 'MASTERCLASS', icon: Icons.PlayCircle, badge: 'nuovo' },
        { id: 'magazzino', label: 'MAGAZZINO', icon: Icons.Package },
        { id: 'staff', label: 'STAFF', icon: Icons.Users },
        { id: 'trattamenti', label: 'TRATTAMENTI', icon: Icons.Scissors },
        { id: 'recensioni', label: 'RECENSIONI', icon: Icons.Heart },
      ];

      return (
        <div className="fixed inset-0 z-50 flex justify-end">
          <div className="fixed inset-0 bg-black/20 backdrop-blur-[1px] transition-opacity" onClick={onClose} />
          <div className="relative w-80 max-w-full bg-white h-full shadow-2xl flex flex-col z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-3 text-tw-blue">
                <button className="p-1.5 hover:bg-blue-50 rounded-full transition" title="Assistenza">
                  <Icons.MessageSquare className="w-5 h-5 text-tw-blue" />
                </button>
                <button className="p-1.5 hover:bg-blue-50 rounded-full transition relative" title="Notifiche">
                  <Icons.Bell className="w-5 h-5 text-tw-blue" />
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
                </button>
              </div>
              <button onClick={onClose} className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded-full transition">
                <Icons.X className="w-5 h-5" />
              </button>
            </div>

            {/* Menu List */}
            <nav className="flex-1 py-3 px-3 flex flex-col gap-1 text-xs font-semibold text-gray-700 uppercase tracking-wider">
              {menuItems.map(item => {
                const ItemIcon = item.icon;
                const isActive = currentSection === item.id;
                return (
                  <button
                    key={item.id}
                    onClick={() => {
                      if (item.id === 'agenda' || item.id === 'orari') {
                        if (onSelectSection) onSelectSection(item.id);
                        onClose();
                      } else {
                        showToast('Modulo ' + item.label + ' disponibile nella versione completa');
                        onClose();
                      }
                    }}
                    className={'w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition cursor-pointer ' +
                      (isActive ? 'bg-tw-blue-light text-tw-blue font-bold' : 'hover:bg-gray-50 text-gray-700')}
                  >
                    <div className="flex items-center gap-3.5">
                      <ItemIcon className={'w-4 h-4 ' + (isActive ? 'text-tw-blue' : 'text-gray-500')} />
                      <span>{item.label}</span>
                    </div>
                    {item.badge && (
                      <span className="bg-tw-blue text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md lowercase tracking-normal">
                        {item.badge}
                      </span>
                    )}
                  </button>
                );
              })}
            </nav>

            {/* Footer */}
            <div className="p-4 border-t border-gray-100 bg-gray-50/80 text-[11px] text-gray-500 text-center">
              TurboBooking v2.5 • Gianluca Tadonio
            </div>
          </div>
        </div>
      );
    }

    // --- RENDER APP ---
    const root = ReactDOM.createRoot(document.getElementById('root'));
    root.render(<TurboBookingApp />);
  `;

  console.log('Pre-compiling JSX to standard JS with classic runtime...');
  const transpiledJs = Babel.transform(appJsxCode, {
    presets: [['react', { runtime: 'classic' }]],
  }).code;
  console.log('Transpilation complete! Output JS size:', (transpiledJs.length / 1024).toFixed(1), 'KB');

  // Build the complete standalone HTML
  const finalHtml = `<!DOCTYPE html>
<html lang="it">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="darkreader-lock" />
  <title>TurboBooking - Demo Salon Management (Gianluca Tadonio)</title>
  
  <!-- Inter Font -->
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700;800;900&display=swap" rel="stylesheet">

  <!-- Tailwind CSS CDN -->
  <script src="https://cdn.tailwindcss.com"></script>
  <script>
    tailwind.config = {
      theme: {
        extend: {
          fontFamily: {
            sans: ['Inter', 'ui-sans-serif', 'system-ui', '-apple-system', 'BlinkMacSystemFont', 'Segoe UI', 'Roboto', 'sans-serif'],
          },
          colors: {
            tw: {
              rail: '#1E293B',
              'rail-dark': '#0F172A',
              blue: '#3584F6',
              'blue-hover': '#2470E0',
              'blue-light': '#EBF3FE',
              canvas: '#F4F6F8',
              border: '#E2E8F0',
              'border-subtle': '#F1F5F9',
              'text-main': '#1E293B',
              'text-muted': '#64748B',
              hatch: '#F1F5F9',
              appointment: '#8DA4B4',
              'appointment-hover': '#7B94A6',
            }
          }
        }
      }
    };
  </script>

  <style>
    body {
      font-family: 'Inter', sans-serif;
      user-select: none;
      -webkit-user-select: none;
    }
    /* Hatched pattern for closed hours/days */
    .bg-tw-hatch {
      background-color: #F8FAFC;
      background-image: repeating-linear-gradient(
        -45deg,
        #F1F5F9,
        #F1F5F9 8px,
        #E2E8F0 8px,
        #E2E8F0 9px
      );
    }
    /* Custom Scrollbar */
    ::-webkit-scrollbar {
      width: 6px;
      height: 6px;
    }
    ::-webkit-scrollbar-track {
      background: #F1F5F9;
    }
    ::-webkit-scrollbar-thumb {
      background: #CBD5E1;
      border-radius: 4px;
    }
    ::-webkit-scrollbar-thumb:hover {
      background: #94A3B8;
    }
    .no-scrollbar::-webkit-scrollbar {
      display: none;
    }
    .no-scrollbar {
      -ms-overflow-style: none;
      scrollbar-width: none;
    }
  </style>
</head>
<body class="bg-tw-canvas text-tw-text-main antialiased overflow-hidden select-none">
  <div id="root"></div>

  <!-- Inlined React 18 Production UMD (Instant execution, 100% standalone) -->
  <script>
${reactUmd}
  </script>

  <!-- Inlined ReactDOM 18 Production UMD -->
  <script>
${reactDomUmd}
  </script>

  <!-- Pre-compiled Native JavaScript Application (Zero Babel needed at runtime) -->
  <script>
${transpiledJs}
  </script>
</body>
</html>
`;

  // 1. Root directory
  const rootPath = path.join(rootDir, 'TurboBooking-Demo.html');
  fs.writeFileSync(rootPath, finalHtml, 'utf8');
  console.log('✅ Saved standalone HTML to root:', rootPath, '(' + (finalHtml.length / 1024).toFixed(1) + ' KB)');

  // 2. Frontend public directory
  const publicPath = path.join(rootDir, 'frontend/public/TurboBooking-Demo.html');
  fs.writeFileSync(publicPath, finalHtml, 'utf8');
  console.log('✅ Saved standalone HTML to frontend/public:', publicPath);

  // 3. User Desktop
  const desktopPath = 'C:\\Users\\MARIO\\Desktop\\TurboBooking-Demo.html';
  try {
    fs.writeFileSync(desktopPath, finalHtml, 'utf8');
    console.log('✅ Saved standalone HTML directly to Desktop:', desktopPath);
  } catch(e) {
    console.log('Could not write directly to Desktop:', e.message);
  }
}

main().catch(err => {
  console.error('Build error:', err);
  process.exit(1);
});
