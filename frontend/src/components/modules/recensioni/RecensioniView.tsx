'use client';

import React, { useState } from 'react';
import { Search, Info } from 'lucide-react';
import { mockReviews } from '@/data/mockData';
import { masterDetailClasses, MobileBackButton } from '@/components/layout/MasterDetail';

export const RecensioniView: React.FC = () => {
  const [selectedReviewId, setSelectedReviewId] = useState<string>('rev-1');
  const [searchQuery, setSearchQuery] = useState('');
  const [replyText, setReplyText] = useState('');
  const [isMobileDetailOpen, setIsMobileDetailOpen] = useState(false);
  const panes = masterDetailClasses(isMobileDetailOpen);

  const currentReview = mockReviews.find((r) => r.id === selectedReviewId) || mockReviews[0];

  return (
    <div className="flex-1 flex h-full bg-white overflow-hidden select-none">
      {/* Sub Sidebar */}
      <div className={`${panes.list} flex-col bg-white`}>
        <div className="p-4 border-b border-gray-100">
          <div className="relative">
            <input
              type="text"
              placeholder="Cerca cliente"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full bg-white border border-gray-200 rounded-full pl-3 pr-8 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
            />
            <Search className="w-3.5 h-3.5 text-gray-400 absolute right-3 top-2.5" />
          </div>
        </div>

        {/* Reviews List */}
        <div className="flex-1 overflow-y-auto p-3 space-y-4">
          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              27 AGOSTO 2026
            </span>
            {mockReviews.slice(0, 2).map((rev) => (
              <div
                key={rev.id}
                onClick={() => {
                  setSelectedReviewId(rev.id);
                  setIsMobileDetailOpen(true);
                }}
                className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                  selectedReviewId === rev.id
                    ? 'bg-tw-blue-light text-tw-blue'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span className="text-xs font-semibold">{rev.clientName}</span>
                <div className="flex text-amber-400 text-xs">★★★★★</div>
              </div>
            ))}
          </div>

          <div className="space-y-1">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider pl-1">
              26 AGOSTO 2026
            </span>
            {mockReviews.slice(2, 4).map((rev) => (
              <div
                key={rev.id}
                onClick={() => {
                  setSelectedReviewId(rev.id);
                  setIsMobileDetailOpen(true);
                }}
                className={`p-3 rounded-xl cursor-pointer transition flex items-center justify-between ${
                  selectedReviewId === rev.id
                    ? 'bg-tw-blue-light text-tw-blue'
                    : 'hover:bg-gray-50 text-gray-800'
                }`}
              >
                <span className="text-xs font-semibold">{rev.clientName}</span>
                <div className="flex text-amber-400 text-xs">★★★★★</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Main Review Details Panel */}
      <div className={`${panes.detail} flex-1 overflow-y-auto p-4 md:p-8 bg-tw-canvas flex-col items-center justify-start md:justify-center`}>
        <div className="w-full max-w-2xl md:hidden">
          <MobileBackButton onClick={() => setIsMobileDetailOpen(false)} label="Recensioni" />
        </div>
        {currentReview && (
          <div className="max-w-2xl w-full space-y-4">
            <div className="text-center space-y-1">
              <div className="flex items-center justify-center gap-1.5 text-base font-bold text-gray-800">
                <span>{currentReview.clientName}</span>
                <Info className="w-4 h-4 text-tw-blue" />
              </div>
              <div className="text-xs text-gray-500">
                Appuntamento preso il {currentReview.appointmentDate}
              </div>
            </div>

            <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden grid grid-cols-1 md:grid-cols-3 md:divide-x divide-gray-100">
              {/* Left 2 Cols: Review Text & Reply Box */}
              <div className="md:col-span-2 p-5 md:p-6 space-y-4 flex flex-col justify-between">
                <div className="space-y-3">
                  <div className="flex text-amber-400 text-base">★★★★★</div>
                  <p className="text-sm font-semibold text-gray-800 leading-relaxed">
                    {currentReview.comment}
                  </p>
                </div>

                <div className="space-y-3 pt-4 border-t border-gray-100">
                  <textarea
                    value={replyText}
                    onChange={(e) => setReplyText(e.target.value)}
                    placeholder="Rispondi alla recensione..."
                    rows={4}
                    className="w-full text-xs p-3 border border-gray-200 rounded-xl focus:outline-none focus:ring-1 focus:ring-tw-blue"
                  />
                  <div className="flex items-center justify-end gap-3 text-xs">
                    <button
                      onClick={() => setReplyText('')}
                      className="font-semibold text-gray-500 hover:text-gray-800 uppercase"
                    >
                      ANNULLA
                    </button>
                    <button
                      onClick={() => {
                        alert('Risposta pubblicata con successo!');
                        setReplyText('');
                      }}
                      className="font-bold text-tw-blue uppercase hover:underline"
                    >
                      RISPONDI
                    </button>
                  </div>
                </div>
              </div>

              {/* Right Col: Rating Details */}
              <div className="p-5 md:p-6 space-y-4 text-xs text-gray-600 bg-gray-50/40 border-t md:border-t-0 border-gray-100">
                <div>
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Collaboratore
                  </span>
                  <div className="font-bold text-gray-800 mt-0.5">{currentReview.staffName}</div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Valutazione dei trattamenti
                  </span>
                  <div className="space-y-1">
                    <div className="font-semibold text-gray-800">{currentReview.treatmentName}</div>
                    <div className="text-amber-400 text-xs">★★★★★</div>
                  </div>
                </div>

                <div className="space-y-2 pt-2 border-t border-gray-100">
                  <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
                    Valutazione del salone
                  </span>
                  <div className="space-y-2">
                    <div className="flex justify-between items-center">
                      <span>Atmosfera e ambiente</span>
                      <span className="text-amber-400">★★★★★</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Pulizia</span>
                      <span className="text-amber-400">★★★★★</span>
                    </div>
                    <div className="flex justify-between items-center">
                      <span>Staff</span>
                      <span className="text-amber-400">★★★★★</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};
