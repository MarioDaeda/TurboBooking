'use client';

import React, { useState } from 'react';
import { Appointment, StaffMember } from '@/types';

interface AgendaViewProps {
  appointments: Appointment[];
  staffList: StaffMember[];
  selectedStaffFilter: string;
  onSelectAppointment: (app: Appointment) => void;
  onNewAppointmentAt: (day: string, time: string, staffId: string) => void;
  onUpdateAppointment?: (app: Appointment) => void;
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

export const AgendaView: React.FC<AgendaViewProps> = ({
  appointments,
  staffList,
  selectedStaffFilter,
  onSelectAppointment,
  onNewAppointmentAt,
  onUpdateAppointment,
}) => {
  const [resizingState, setResizingState] = useState<ResizingState | null>(null);

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

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!resizingState) return;

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
  };

  const handlePointerUp = (e: React.PointerEvent) => {
    if (!resizingState) return;
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

    setResizingState(null);
  };
  const days = [
    { key: 'LUN 31', name: 'LUN', date: '31', isClosed: true },
    { key: 'MAR 1', name: 'MAR', date: '1', isClosed: false },
    { key: 'MER 2', name: 'MER', date: '2', isClosed: false, isToday: true },
    { key: 'GIO 3', name: 'GIO', date: '3', isClosed: false },
    { key: 'VEN 4', name: 'VEN', date: '4', isClosed: false },
    { key: 'SAB 5', name: 'SAB', date: '5', isClosed: false },
    { key: 'DOM 6', name: 'DOM', date: '6', isClosed: true },
  ];

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
        <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
          {days.map((day) => (
            <div
              key={day.key}
              className={`flex flex-col text-center py-2 ${
                day.isToday ? 'bg-blue-50/60' : day.isClosed ? 'bg-gray-100/60' : ''
              }`}
            >
              <div className="text-[11px] font-bold text-gray-700">
                {day.name}{' '}
                <span className={day.isToday ? 'text-tw-blue font-extrabold' : ''}>
                  {day.date}
                </span>
              </div>

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
          <div className="flex-1 grid grid-cols-7 divide-x divide-gray-200">
            {days.map((day) => (
              <div
                key={day.key}
                className={`relative flex divide-x divide-gray-100 ${
                  day.isClosed ? 'bg-tw-hatch' : 'bg-white'
                }`}
              >
                {filteredStaff.map((staff) => (
                  <div key={staff.id} className="flex-1 relative divide-y divide-gray-100 min-w-0">
                    {timeSlots.map((time) => {
                      const isClosedHour =
                        day.isClosed ||
                        time < '07:30' ||
                        time > '19:30';

                      return (
                        <div
                          key={time}
                          onClick={() => {
                            if (!isClosedHour) {
                              onNewAppointmentAt(day.key, time, staff.id);
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

                    {/* Render Appointments positioned on grid */}
                    {appointments
                      .filter(
                        (app) =>
                          app.dayOfWeek === day.key &&
                          (app.staffId === staff.id || app.staffInitials === staff.initials)
                      )
                      .map((app) => {
                        const isBeingResized = resizingState?.appId === app.id;
                        const effectiveStartTime = isBeingResized
                          ? resizingState.currentStartTime
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
                            onClick={(e) => {
                              if (resizingState) return;
                              e.stopPropagation();
                              onSelectAppointment(app);
                            }}
                            style={{
                              top: `${topPixels}px`,
                              height: `${heightPixels}px`,
                            }}
                            className={`group absolute inset-x-1 z-10 rounded-lg p-2 bg-tw-appointment text-white text-xs shadow-md border-l-4 border-white/80 flex flex-col justify-between cursor-pointer transition-shadow select-none ${
                              isBeingResized
                                ? 'ring-2 ring-tw-blue shadow-xl z-30 brightness-105'
                                : 'hover:brightness-95'
                            }`}
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

                            {/* Live Tooltip when resizing */}
                            {isBeingResized && (
                              <div className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-900 text-white text-[10px] font-bold px-2.5 py-0.5 rounded-full shadow-lg whitespace-nowrap z-40 pointer-events-none flex items-center gap-1.5 animate-in fade-in">
                                <span>{effectiveStartTime} – {endTimeStr}</span>
                                <span className="text-blue-300 font-mono">({effectiveDurationFormatted})</span>
                              </div>
                            )}

                            {/* Content */}
                            <div className="font-semibold leading-tight truncate pointer-events-none mt-0.5">
                              {app.clientName}
                            </div>
                            <div className="text-[10px] text-white/90 truncate flex items-center justify-between pointer-events-none mb-0.5">
                              <span>{app.serviceName}</span>
                              <span className="font-mono text-[9px]">{effectiveDurationFormatted}</span>
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
    </div>
  );
};
