'use client';

import React from 'react';
import { PlayCircle, Scissors, LineChart, Droplet, Sparkles, User, ChevronRight } from 'lucide-react';
import { mockMasterclasses } from '@/data/mockData';

export const MasterclassView: React.FC = () => {
  const categories = [
    { name: 'Taglio', icon: <Scissors className="w-4 h-4 text-tw-blue" />, bg: 'bg-blue-50' },
    { name: 'Marketing', icon: <LineChart className="w-4 h-4 text-amber-600" />, bg: 'bg-amber-50' },
    { name: 'Colore', icon: <Droplet className="w-4 h-4 text-purple-600" />, bg: 'bg-purple-50' },
    { name: 'Styling', icon: <Sparkles className="w-4 h-4 text-emerald-600" />, bg: 'bg-emerald-50' },
    { name: 'Barba', icon: <User className="w-4 h-4 text-cyan-600" />, bg: 'bg-cyan-50' },
  ];

  return (
    <div className="flex-1 h-full bg-tw-canvas overflow-y-auto p-8 select-none">
      <div className="max-w-6xl mx-auto space-y-10">
        {/* Hero Section Banner */}
        <div className="bg-white rounded-3xl p-10 border border-gray-200/80 shadow-xs flex items-center justify-between gap-10">
          <div className="max-w-xl space-y-4">
            <span className="text-[10px] font-extrabold uppercase tracking-widest text-tw-blue">
              NOVITÀ · INCLUSO CON TURBOBOOKING
            </span>
            <h2 className="text-3xl font-extrabold text-gray-900 leading-tight">
              Fai crescere le tue competenze, fai crescere il tuo salone.
            </h2>
            <p className="text-xs text-gray-500 leading-relaxed">
              Impara le migliori tecniche da stylist e barber per far crescere la tua clientela
              fedele.
            </p>
            <div className="pt-2">
              <button
                onClick={() => alert('Esplorazione Masterclass')}
                className="px-6 py-2.5 bg-tw-blue hover:bg-tw-blue-hover text-white text-xs font-bold rounded-xl shadow-sm transition"
              >
                Esplora Masterclass
              </button>
            </div>
          </div>

          <div className="w-96 h-60 rounded-2xl overflow-hidden shadow-md flex-shrink-0 relative">
            <img
              src="https://images.unsplash.com/photo-1522337360788-8b13dee7a37e?w=800&auto=format&fit=crop&q=80"
              alt="Masterclass Banner"
              className="w-full h-full object-cover"
            />
          </div>
        </div>

        {/* Section: Nuovi corsi ogni mese */}
        <div className="space-y-4">
          <div className="text-center">
            <h3 className="text-lg font-bold text-gray-800">Nuovi corsi ogni mese</h3>
          </div>

          <div className="flex items-center justify-between text-xs font-bold uppercase tracking-wider text-gray-500 pt-2">
            <span>PIÙ POPOLARI</span>
            <button className="text-tw-blue hover:underline">Vedi tutti</button>
          </div>

          {/* Cards Grid */}
          <div className="grid grid-cols-4 gap-6">
            {mockMasterclasses.map((course) => (
              <div
                key={course.id}
                className="bg-white rounded-2xl border border-gray-200 overflow-hidden shadow-xs hover:shadow-md transition cursor-pointer flex flex-col"
              >
                <div className="h-44 overflow-hidden relative">
                  <img
                    src={course.thumbnail}
                    alt={course.title}
                    className="w-full h-full object-cover hover:scale-105 transition duration-300"
                  />
                  <div className="absolute inset-0 bg-black/10 flex items-center justify-center opacity-0 hover:opacity-100 transition">
                    <PlayCircle className="w-12 h-12 text-white" />
                  </div>
                </div>
                <div className="p-4 flex-1 flex flex-col justify-between space-y-2">
                  <span className="text-[10px] font-semibold text-tw-blue bg-blue-50 px-2 py-0.5 rounded-md w-max">
                    {course.level}
                  </span>
                  <h4 className="font-bold text-xs text-gray-800 line-clamp-2">
                    {course.title}
                  </h4>
                  <div className="text-[11px] text-gray-400 flex items-center gap-1 pt-1">
                    <PlayCircle className="w-3 h-3" />
                    <span>{course.videosCount} video</span>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-center pt-4">
            <button
              onClick={() => alert('Tutti i corsi')}
              className="px-6 py-2 border border-tw-blue text-tw-blue font-bold text-xs rounded-xl hover:bg-blue-50 transition"
            >
              Esplora tutti i corsi
            </button>
          </div>
        </div>

        {/* Section: Corsi per ogni fase */}
        <div className="space-y-6 pt-6">
          <div className="text-center space-y-1">
            <h3 className="text-lg font-bold text-gray-800">
              Corsi per ogni fase della tua carriera
            </h3>
            <p className="text-xs text-gray-500">
              Che tu sia alle prime armi o un professionista affermato, trova il corso che ti aiuta
              a perfezionare le tue competenze
            </p>
          </div>

          <div className="grid grid-cols-5 gap-4">
            {categories.map((cat) => (
              <div
                key={cat.name}
                className="bg-white rounded-2xl border border-gray-200 p-5 shadow-xs hover:shadow-md transition cursor-pointer flex flex-col justify-between h-36"
              >
                <div className={`w-8 h-8 rounded-xl ${cat.bg} flex items-center justify-center`}>
                  {cat.icon}
                </div>
                <div>
                  <h4 className="font-bold text-xs text-gray-800">{cat.name}</h4>
                  <div className="text-[11px] text-tw-blue font-semibold flex items-center gap-0.5 mt-0.5">
                    <span>Esplora</span>
                    <ChevronRight className="w-3 h-3" />
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
