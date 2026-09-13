'use client';

import React from 'react';
import { ChevronLeft } from 'lucide-react';

/**
 * Layout elenco/dettaglio responsive.
 * Da md in su i due pannelli sono affiancati; su mobile se ne mostra uno alla volta:
 * l'elenco finché non si apre un elemento, poi il dettaglio con il tasto "Indietro".
 */
export const masterDetailClasses = (isDetailOpen: boolean) => ({
  list: `${isDetailOpen ? 'hidden md:flex' : 'flex'} w-full md:w-80 md:border-r border-gray-200`,
  detail: `${isDetailOpen ? 'flex' : 'hidden md:flex'}`,
});

interface MobileBackButtonProps {
  onClick: () => void;
  label?: string;
  className?: string;
}

export const MobileBackButton: React.FC<MobileBackButtonProps> = ({
  onClick,
  label = 'Indietro',
  className = '',
}) => (
  <button
    type="button"
    onClick={onClick}
    className={`md:hidden flex items-center gap-1 -ml-1 py-2 pr-3 text-sm font-semibold text-tw-blue ${className}`}
  >
    <ChevronLeft className="w-5 h-5" />
    <span>{label}</span>
  </button>
);
