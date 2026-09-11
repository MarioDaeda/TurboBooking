'use client';

import React, { useMemo, useRef, useState } from 'react';
import { Move, Clock } from 'lucide-react';
import { Appointment, StaffMember, DaySchedule } from '@/types';
import { AGENDA_DAYS, getTodayIndex, AgendaDay } from '@/lib/agendaDays';
import { DayScheduleModal } from '@/components/modals/DayScheduleModal';

interface AgendaViewProps {
  appointments: Appointment[];
  staffList: StaffMember[];
  selectedStaffFilter: string;
  onSelectAppointment: (app: Appointment) => void;
  onNewAppointmentAt: (day: string, time: string, staffId: string) => void;
  onUpdateAppointment?: (app: Appointment) => void;
  viewMode?: 'giornaliero' | 'settimanale';
  selectedDay?: string;
  salonHours?: DaySchedule[];
  dayOverrides?: { [dayKey: string]: { isOpen: boolean; openTime: string; closeTime: string } };
  onSaveDaySchedule?: (params: {
    dayKey: string;
    dayName: string;
    isOpen: boolean;
    openTime: string;
    closeTime: string;
    applyToAllMatchingDays: boolean;
  }) => void;
  onResetDayOverride?: (dayKey: string) => void;
}

interface ResizingState {
  appId: string;
  edge: 'top' | 'bottom';
  initialY: number;
  initialStartMinutes: number;
  initialDurationMinutes: number;
  currentStartTime: string;
  currentDurationMinutes: number;
  currentDurationFormatted: string;
}

interface DraggingState {
  appId: string;
  initialX: number;
  initialY: number;
  hasMoved: boolean;
  initialStartMinutes: number;
  durationMinutes: number;
  durationFormatted: string;
  initialDayOfWeek: string;
  initialStaffId: string;
  currentStartTime: string;
  currentDayOfWeek: string;
  currentStaffId: string;
}

const toMinutes = (timeStr: string): number => {
  const [h, m] = timeStr.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
};

const toTimeString = (totalMinutes: number): string => {
  const clamped = Math.max(0, Math.min(24 * 60 - 1, totalMinutes));
  const h = Math.floor(clamped / 60);
  const m = clamped % 60;
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
};

const formatDurationHours = (minutes: number): string => {
  const h = Math.floor(minutes / 60);
  const m = minutes % 60;
  return `${h}.${m.toString().padStart(2, '0')}h`;
};

const getIsoDateForDayKey = (dayKey: string): string => {
  const found = AGENDA_DAYS.find((d) => d.key === dayKey);
  if (!found) return '2026-09-02';
  const dayNum = found.date.padStart(2, '0');
  const month = found.date === '31' ? '08' : '09';
  return `2026-${month}-${dayNum}`;
};

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  staffList,
  selectedStaffFilter,
  onSelectAppointment,
  onNewAppointmentAt,
  onUpdateAppointment,
  viewMode = 'settimanale',
  selectedDay,
  salonHours,
  dayOverrides,
  onSaveDaySchedule,
  onResetDayOverride,
}) => {
  const [resizingState, setResizingState] = useState<ResizingState | null>(null);
  const [draggingState, setDraggingState] = useState<DraggingState | null>(null);
  const [selectedDayForSchedule, setSelectedDayForSchedule] = useState<AgendaDay | null>(null);
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);
  const justResizedRef = useRef(false);

  const handleOpenDaySchedule = (day: AgendaDay) => {
    setSelectedDayForSchedule(day);
    setIsScheduleModalOpen(true);
  };

  const handlePointerDownTop = (e: React.PointerEvent, app: Appointment) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

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

  const handlePointerDownBottom = (e: React.PointerEvent, app: Appointment) => {
    e.stopPropagation();
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

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

  const handlePointerDownCard = (e: React.PointerEvent, app: Appointment) => {
    if (e.button !== 0) return;
    if (resizingState) return;

    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (resizingState) {
      const deltaY = e.clientY - resizingState.initialY;
      // 56px = 30 minutes -> rawDeltaMinutes = deltaY * (30 / 56)
      // Snap to 15-minute intervals
      const rawDeltaMinutes = deltaY * (30 / 56);
      const snapMinutes = Math.round(rawDeltaMinutes / 15) * 15;

      if (resizingState.edge === 'bottom') {
        const newDuration = Math.max(15, resizingState.initialDurationMinutes + snapMinutes);
        const maxDuration = 20 * 60 - resizingState.initialStartMinutes;
        const clampedDuration = Math.min(newDuration, Math.max(15, maxDuration));

        setResizingState((prev) =>
          prev
            ? {
                ...prev,
                currentDurationMinutes: clampedDuration,
                currentDurationFormatted: formatDurationHours(clampedDuration),
              }
            : null
        );
      } else if (resizingState.edge === 'top') {
        const originalEndMinutes =
          resizingState.initialStartMinutes + resizingState.initialDurationMinutes;

        let newStartMinutes = resizingState.initialStartMinutes + snapMinutes;
        newStartMinutes = Math.max(7 * 60, newStartMinutes);
        if (originalEndMinutes - newStartMinutes < 15) {
          newStartMinutes = originalEndMinutes - 15;
        }

        const clampedDuration = originalEndMinutes - newStartMinutes;
        const newStartTimeStr = toTimeString(newStartMinutes);

        setResizingState((prev) =>
          prev
            ? {
                ...prev,
                currentStartTime: newStartTimeStr,
                currentDurationMinutes: clampedDuration,
                currentDurationFormatted: formatDurationHours(clampedDuration),
              }
            : null
        );
      }
      return;
    }

    if (draggingState) {
      const deltaX = Math.abs(e.clientX - draggingState.initialX);
      const deltaY = Math.abs(e.clientY - draggingState.initialY);

      // Threshold: at least 4 pixels to distinguish drag from a click
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

      if (typeof document !== 'undefined' && document.elementsFromPoint) {
        const elements = document.elementsFromPoint(e.clientX, e.clientY);
        for (const el of elements) {
          const col = (el as HTMLElement).closest?.('[data-agenda-column="true"]') as HTMLElement | null;
          if (col && col.dataset.day && col.dataset.staffId) {
            const isClosed = col.dataset.isClosed === 'true';
            if (!isClosed) {
              targetDay = col.dataset.day;
              targetStaffId = col.dataset.staffId;
            }
            break;
          }
        }
      }

      setDraggingState((prev) =>
        prev
          ? {
              ...prev,
              hasMoved,
              currentStartTime: newStartTimeStr,
              currentDayOfWeek: targetDay,
              currentStaffId: targetStaffId,
            }
          : null
      );
    }
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (resizingState) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      const targetApp = appointments.find((a) => a.id === resizingState.appId);
      if (targetApp && onUpdateAppointment) {
        const updatedApp: Appointment = {
          ...targetApp,
          startTime: resizingState.currentStartTime,
          durationMinutes: resizingState.currentDurationMinutes,
          durationFormatted: resizingState.currentDurationFormatted,
        };
        onUpdateAppointment(updatedApp);
      }

      justResizedRef.current = true;
      setResizingState(null);
      return;
    }

    if (draggingState) {
      try {
        (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
      } catch {}

      if (draggingState.hasMoved) {
        const targetApp = appointments.find((a) => a.id === draggingState.appId);
        if (targetApp && onUpdateAppointment) {
          const targetStaff =
            staffList.find((s) => s.id === draggingState.currentStaffId) ||
            staffList.find((s) => s.id === targetApp.staffId) ||
            staffList[0];

          const updatedApp: Appointment = {
            ...targetApp,
            startTime: draggingState.currentStartTime,
            dayOfWeek: draggingState.currentDayOfWeek,
            date: getIsoDateForDayKey(draggingState.currentDayOfWeek),
            staffId: targetStaff.id,
            staffName: targetStaff.name,
            staffInitials: targetStaff.initials,
          };
          onUpdateAppointment(updatedApp);
        }
        justResizedRef.current = true;
      }

      setDraggingState(null);
    }
  };
  const todayIndex = useMemo(() => getTodayIndex(), []);

  const daysWithSchedule = useMemo(() => {
    return AGENDA_DAYS.map((day, idx) => {
      // 1. Check explicit override for this specific date (e.g. "MER 2" or "LUN 31")
      const override = dayOverrides?.[day.key];

      // 2. Look up standard schedule in salonHours (e.g. "MER" -> "Mercoledì")
      const standard = salonHours?.find((s) => s.shortName === day.name);

      const isOpen = override
        ? override.isOpen
        : standard
        ? standard.isOpen
        : !day.isClosed;

      const openTime = override?.openTime || standard?.openTime || (day.name === 'SAB' ? '08:00' : '07:00');
      const closeTime = override?.closeTime || standard?.closeTime || (day.name === 'SAB' ? '18:00' : '20:00');
      const isOverridden = !!override;

      return {
        ...day,
        isToday: idx === todayIndex,
        isOpen,
        isClosed: !isOpen,
        openTime,
        closeTime,
        isOverridden,
      };
    });
  }, [salonHours, dayOverrides, todayIndex]);

  // In vista "giornaliero" mostriamo solo il giorno selezionato, non l'intera settimana.
  const days =
    viewMode === 'giornaliero'
      ? daysWithSchedule.filter((d) => d.key === (selectedDay ?? daysWithSchedule[todayIndex].key))
      : daysWithSchedule;

  const timeSlots = [
    '07:00', '07:30', '08:00', '08:30', '09:00', '09:30',
    '10:00', '10:30', '11:00', '11:30', '12:00', '12:30',
    '13:00', '13:30', '14:00', '14:30', '15:00', '15:30',
    '16:00', '16:30', '17:00', '17:30', '18:00', '18:30',
    '19:00', '19:30', '20:00',
  ];

  const filteredStaff =
    selectedStaffFilter === 'all'
      ? staffList
      : staffList.filter((s) => s.id === selectedStaffFilter);

  return (
    <div className="flex-1 flex flex-col h-full bg-white overflow-hidden select-none">
      {/* Week Header */}
      <div className="flex border-b border-gray-200 bg-gray-50/50 sticky top-0 z-10">
        {/* Time gutter header */}
        <div className="w-16 border-r border-gray-200 flex-shrink-0" />

        {/* Days Columns Header */}
        <div
          className="flex-1 grid divide-x divide-gray-200"
          style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
        >
          {days.map((day) => (
            <div
              key={day.key}
              onClick={() => handleOpenDaySchedule(day)}
              title="Clicca per modificare orari o forzare apertura/chiusura per questo giorno"
              className={`flex flex-col text-center py-2 transition cursor-pointer select-none group/day relative ${
                day.isToday
                  ? 'bg-blue-50/60 hover:bg-blue-100/70'
                  : day.isClosed
                  ? 'bg-gray-100/70 hover:bg-gray-200/70'
                  : 'hover:bg-blue-50/50'
              }`}
            >
              <div className="text-[11px] font-bold text-gray-700 flex items-center justify-center gap-1">
                <span>{day.name}</span>
                <span className={day.isToday ? 'text-tw-blue font-extrabold' : ''}>
                  {day.date}
                </span>
                <Clock className="w-3 h-3 text-gray-400 group-hover/day:text-tw-blue transition opacity-40 group-hover/day:opacity-100" />
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

              {/* Sub-columns for Staff initials */}
              <div className="flex justify-around mt-1 pt-1 border-t border-gray-200/60 text-[10px] text-gray-500 font-semibold">
                {filteredStaff.map((staff) => (
                  <span key={staff.id}>{staff.initials}</span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Grid Body */}
      <div className="flex-1 overflow-y-auto relative">
        <div className="flex">
          {/* Time Gutter */}
          <div className="w-16 border-r border-gray-200 flex-shrink-0 divide-y divide-gray-100 bg-white">
            {timeSlots.map((time) => (
              <div
                key={time}
                className="h-14 px-2 py-1 text-[11px] font-medium text-gray-500 text-right flex items-start justify-end"
              >
                {time}
              </div>
            ))}
          </div>

          {/* Days Grid Columns */}
          <div
            className="flex-1 grid divide-x divide-gray-200"
            style={{ gridTemplateColumns: `repeat(${days.length}, minmax(0, 1fr))` }}
          >
            {days.map((day) => (
              <div
                key={day.key}
                className={`relative flex divide-x divide-gray-100 ${
                  day.isClosed ? 'bg-tw-hatch' : 'bg-white'
                }`}
              >
                {filteredStaff.map((staff) => (
                  <div
                    key={staff.id}
                    data-agenda-column="true"
                    data-day={day.key}
                    data-staff-id={staff.id}
                    data-is-closed={day.isClosed ? 'true' : 'false'}
                    className="flex-1 relative divide-y divide-gray-100 min-w-0"
                  >
                    {timeSlots.map((time) => {
                      const open = day.openTime || '07:00';
                      const close = day.closeTime || '20:00';
                      const isClosedHour =
                        day.isClosed ||
                        time < open ||
                        time >= close;

                      return (
                        <div
                          key={time}
                          onClick={() => {
                            if (!isClosedHour) {
                              onNewAppointmentAt(day.key, time, staff.id);
                            } else if (day.isClosed) {
                              handleOpenDaySchedule(day);
                            }
                          }}
                          className={`h-14 transition cursor-pointer relative group ${
                            isClosedHour
                              ? 'bg-tw-hatch cursor-not-allowed opacity-90'
                              : 'hover:bg-blue-50/40'
                          }`}
                        >
                          {/* Subtle hover plus icon */}
                          {!isClosedHour && (
                            <div className="hidden group-hover:flex items-center justify-center h-full text-tw-blue font-bold text-xs opacity-40">
                              +
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* Ghost card in original position while dragging */}
                    {draggingState?.hasMoved &&
                      draggingState.initialDayOfWeek === day.key &&
                      draggingState.initialStaffId === staff.id && (
                        (() => {
                          const origStartTotal = draggingState.initialStartMinutes - 7 * 60;
                          const origTop = (origStartTotal / 30) * 56;
                          const origHeight = Math.max((draggingState.durationMinutes / 30) * 56 - 4, 28);
                          return (
                            <div
                              style={{
                                top: `${origTop}px`,
                                height: `${origHeight}px`,
                              }}
                              className="absolute inset-x-1 rounded-lg p-2 border-2 border-dashed border-tw-blue/50 bg-blue-50/40 text-tw-blue text-xs flex flex-col justify-between pointer-events-none z-10"
                            >
                              <div className="font-bold text-[11px] truncate opacity-70">
                                Spostamento in corso...
                              </div>
                              <div className="text-[10px] font-mono opacity-60">
                                Origine: {toTimeString(draggingState.initialStartMinutes)}
                              </div>
                            </div>
                          );
                        })()
                    )}

                    {/* Render Appointments positioned on grid */}
                    {appointments
                      .filter((app) => {
                        const isThisAppDragged = draggingState?.appId === app.id;
                        const effectiveDay = isThisAppDragged ? draggingState.currentDayOfWeek : app.dayOfWeek;
                        const effectiveStaff = isThisAppDragged ? draggingState.currentStaffId : app.staffId;

                        return (
                          effectiveDay === day.key &&
                          (effectiveStaff === staff.id || app.staffInitials === staff.initials)
                        );
                      })
                      .map((app) => {
                        const isBeingResized = resizingState?.appId === app.id;
                        const isBeingDragged = draggingState?.appId === app.id && draggingState.hasMoved;

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

                        // Calculate position based on effective start time
                        const [hours, minutes] = effectiveStartTime.split(':').map(Number);
                        const startTotalMinutes = hours * 60 + minutes - 7 * 60; // 07:00 is base
                        const topPixels = (startTotalMinutes / 30) * 56; // each 30 mins is 56px (h-14)
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
                              if (resizingState || draggingState?.hasMoved || justResizedRef.current) {
                                justResizedRef.current = false;
                                return;
                              }
                              onSelectAppointment(app);
                            }}
                            style={{
                              top: `${topPixels}px`,
                              height: `${heightPixels}px`,
                              backgroundColor: app.serviceColor || '#1B6478',
                            }}
                            className={`group absolute inset-x-1 rounded-lg p-2 text-white text-xs shadow-md border-l-4 border-white/80 flex flex-col justify-between select-none touch-none transition-shadow ${
                              isBeingDragged
                                ? 'ring-4 ring-tw-blue shadow-2xl z-50 brightness-110 scale-[1.02] cursor-grabbing opacity-95'
                                : isBeingResized
                                ? 'ring-2 ring-tw-blue shadow-xl z-30 brightness-105 cursor-ns-resize'
                                : 'cursor-grab hover:shadow-lg hover:brightness-95 z-20 active:cursor-grabbing'
                            }`}
                            title="Trascina al centro per spostare, o clicca per i dettagli"
                          >
                            {/* Top Resize Handle (Google Calendar style) */}
                            <div
                              onPointerDown={(e) => handlePointerDownTop(e, app)}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              className="absolute top-0 inset-x-0 h-3 cursor-ns-resize z-20 group/handle flex items-start justify-center touch-none"
                              title="Trascina bordo superiore per modificare l'inizio"
                            >
                              <div className="w-8 h-1 rounded-full bg-white/40 group-hover/handle:bg-white group-active/handle:bg-white shadow-xs transition mt-0.5" />
                            </div>

                            {/* Live Tooltip when dragging */}
                            {isBeingDragged && (
                              <div className="absolute -top-8 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[11px] font-bold px-3.5 py-1 rounded-full shadow-2xl whitespace-nowrap z-50 pointer-events-none flex items-center gap-2 animate-in fade-in">
                                <span className="text-blue-300 uppercase tracking-wide">{day.name} {day.date}</span>
                                <span>•</span>
                                <span>{effectiveStartTime} – {endTimeStr}</span>
                                <span>•</span>
                                <span className="text-amber-300 font-semibold">{staff.name}</span>
                              </div>
                            )}

                            {/* Live Tooltip when resizing */}
                            {isBeingResized && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap z-40 pointer-events-none flex items-center gap-1.5 animate-in fade-in">
                                <span>{effectiveStartTime} – {endTimeStr}</span>
                                <span className="text-blue-300 font-mono">({effectiveDurationFormatted})</span>
                              </div>
                            )}

                            {/* Content */}
                            <div className="font-bold leading-tight truncate pointer-events-none mt-0.5 flex items-center justify-between">
                              <span className="truncate uppercase text-[11px] tracking-tight">{app.clientName}</span>
                              <Move className="w-3 h-3 text-white/50 opacity-0 group-hover:opacity-100 transition shrink-0 ml-1" />
                            </div>
                            <div className="text-[10px] text-white/95 font-medium truncate flex items-center justify-between pointer-events-none mb-0.5">
                              <div className="flex items-center gap-1.5 truncate">
                                <span className="w-1.5 h-1.5 rounded-full bg-amber-300 shrink-0 inline-block shadow-xs" />
                                <span className="truncate uppercase">{app.serviceName}</span>
                              </div>
                              <span className="font-mono text-[9px] font-semibold shrink-0 ml-1 text-white/90">{effectiveDurationFormatted}</span>
                            </div>

                            {/* Bottom Resize Handle (Google Calendar style) */}
                            <div
                              onPointerDown={(e) => handlePointerDownBottom(e, app)}
                              onPointerMove={handlePointerMove}
                              onPointerUp={handlePointerUp}
                              onPointerCancel={handlePointerUp}
                              className="absolute bottom-0 inset-x-0 h-3 cursor-ns-resize z-20 group/handle flex items-end justify-center touch-none"
                              title="Trascina bordo inferiore per modificare la durata"
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

      {/* Day Schedule Modal (direct click on day header) */}
      <DayScheduleModal
        isOpen={isScheduleModalOpen}
        onClose={() => {
          setIsScheduleModalOpen(false);
          setSelectedDayForSchedule(null);
        }}
        day={selectedDayForSchedule}
        onSave={(params) => {
          if (onSaveDaySchedule) {
            onSaveDaySchedule(params);
          }
        }}
        onResetOverride={(dayKey) => {
          if (onResetDayOverride) {
            onResetDayOverride(dayKey);
          }
        }}
      />
    </div>
  );
};
