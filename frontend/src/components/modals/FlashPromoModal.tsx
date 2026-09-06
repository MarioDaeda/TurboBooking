'use client';

import React, { useState } from 'react';
import { X } from 'lucide-react';

interface FlashPromoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSavePromo: (promo: { duration: string; target: string; discount: string }) => void;
}

export const FlashPromoModal: React.FC<FlashPromoModalProps> = ({
  isOpen,
  onClose,
  onSavePromo,
}) => {
  const [duration, setDuration] = useState('Solo per oggi');
  const [target, setTarget] = useState('Tutto il listino');
  const [discount, setDiscount] = useState('- 20%');

  if (!isOpen) return null;

  const handleSave = () => {
    onSavePromo({ duration, target, discount });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40 backdrop-blur-[2px]">
      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-2xl overflow-hidden border border-gray-100 animate-in fade-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="relative px-8 py-5 border-b border-gray-100 flex items-center justify-center">
          <h2 className="text-xs font-bold text-gray-800 uppercase tracking-wider">
            FLASH PROMO
          </h2>
          <button
            onClick={onClose}
            className="absolute right-6 p-1.5 hover:bg-gray-100 text-gray-500 rounded-lg transition"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <div className="p-8 space-y-6">
          <p className="text-xs text-gray-600 leading-relaxed text-center max-w-md mx-auto">
            Crea delle promozioni flash così da riempire gli spazi vuoti in agenda anche
            all&apos;ultimo istante. I clienti potranno prenotare online all&apos;attivazione della
            promozione, approfittando dello sconto che tu avrai scelto.
          </p>

          <hr className="border-gray-100" />

          {/* Section: DURATA */}
          <div className="space-y-2 text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              DURATA
            </span>
            <div className="flex items-center justify-center gap-6 pt-1">
              {['Solo per oggi', '24 ore', '48 ore', '72 ore'].map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700"
                >
                  <input
                    type="radio"
                    name="promoDuration"
                    value={option}
                    checked={duration === option}
                    onChange={(e) => setDuration(e.target.value)}
                    className="w-4 h-4 text-tw-blue focus:ring-0"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section: APPLICA A */}
          <div className="space-y-2 text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              APPLICA A
            </span>
            <div className="flex items-center justify-center gap-8 pt-1">
              {['Tutto il listino', 'Personalizza'].map((option) => (
                <label
                  key={option}
                  className="flex items-center gap-2 cursor-pointer text-xs font-medium text-gray-700"
                >
                  <input
                    type="radio"
                    name="promoTarget"
                    value={option}
                    checked={target === option}
                    onChange={(e) => setTarget(e.target.value)}
                    className="w-4 h-4 text-tw-blue focus:ring-0"
                  />
                  <span>{option}</span>
                </label>
              ))}
            </div>
          </div>

          <hr className="border-gray-100" />

          {/* Section: SCONTO */}
          <div className="space-y-2 text-center">
            <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
              SCONTO
            </span>
            <div className="pt-1 flex justify-center">
              <select
                value={discount}
                onChange={(e) => setDiscount(e.target.value)}
                className="w-48 text-center bg-white border border-gray-200 rounded-xl px-4 py-2 text-xs font-medium text-gray-700 focus:outline-none focus:ring-1 focus:ring-tw-blue"
              >
                <option value="- 10%">- 10%</option>
                <option value="- 15%">- 15%</option>
                <option value="- 20%">- 20%</option>
                <option value="- 30%">- 30%</option>
                <option value="- 50%">- 50%</option>
              </select>
            </div>
          </div>

          {/* Action Button */}
          <div className="pt-4 flex justify-center">
            <button
              onClick={handleSave}
              className="w-56 py-2.5 bg-tw-blue-pill hover:bg-tw-blue text-tw-blue hover:text-white font-bold text-xs uppercase tracking-wider rounded-full transition duration-150"
            >
              SALVA
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
