'use client';

import React, { useState } from 'react';
import { SectionId } from '@/types';
import {
  X,
  MessageSquare,
  Bell,
  Calendar,
  CreditCard,
  BookUser,
  Tag,
  PlayCircle,
  Package,
  Megaphone,
  CircleDollarSign,
  Clock,
  Scissors,
  Users,
  Armchair,
  Truck,
  LineChart,
  Star,
  UserCircle,
  ChevronDown,
} from 'lucide-react';

interface MainDrawerMenuProps {
  isOpen: boolean;
  onClose: () => void;
  currentSection: SectionId;
  onSelectSection: (section: SectionId) => void;
}

export const MainDrawerMenu: React.FC<MainDrawerMenuProps> = ({
  isOpen,
  onClose,
  currentSection,
  onSelectSection,
}) => {
  const [openSubmenus, setOpenSubmenus] = useState<{ [key: string]: boolean }>({
    magazzino: false,
    orari: false,
    fornitori: false,
    statistiche: false,
  });

  React.useEffect(() => {
    if (currentSection.startsWith('magazzino')) {
      setOpenSubmenus((prev) => ({ ...prev, magazzino: true }));
    } else if (currentSection.startsWith('orari')) {
      setOpenSubmenus((prev) => ({ ...prev, orari: true }));
    } else if (
      currentSection.startsWith('fornitori') ||
      currentSection === 'produttori' ||
      currentSection === 'spedizioni'
    ) {
      setOpenSubmenus((prev) => ({ ...prev, fornitori: true }));
    } else if (currentSection.startsWith('statistiche')) {
      setOpenSubmenus((prev) => ({ ...prev, statistiche: true }));
    }
  }, [currentSection, isOpen]);

  const toggleSubmenu = (menuKey: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setOpenSubmenus((prev) => ({ ...prev, [menuKey]: !prev[menuKey] }));
  };

  const handleNavigate = (section: SectionId) => {
    onSelectSection(section);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 backdrop-blur-[1px] transition-opacity"
        onClick={onClose}
      />

      {/* Drawer Panel */}
      <div className="relative w-80 max-w-full bg-white h-full shadow-2xl flex flex-col z-50 overflow-y-auto animate-in slide-in-from-right duration-200">
        {/* Top Header Icons */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-4 text-tw-blue">
            <button className="p-1.5 hover:bg-blue-50 rounded-full transition" title="Assistenza & Chat">
              <MessageSquare className="w-5 h-5 text-tw-blue" />
            </button>
            <button className="p-1.5 hover:bg-blue-50 rounded-full transition relative" title="Notifiche">
              <Bell className="w-5 h-5 text-tw-blue" />
              <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full" />
            </button>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 hover:bg-gray-100 text-gray-500 hover:text-gray-800 rounded-full transition"
            title="Chiudi Menu"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Navigation Links */}
        <nav className="flex-1 py-3 px-3 flex flex-col gap-0.5 text-xs font-semibold text-gray-700 uppercase tracking-wider">
          {/* 1. AGENDA */}
          <button
            onClick={() => handleNavigate('agenda')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'agenda' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Calendar className="w-4 h-4 text-gray-500" />
            <span>AGENDA</span>
          </button>

          {/* 2. CASSA */}
          <button
            onClick={() => handleNavigate('cassa')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'cassa' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <CreditCard className="w-4 h-4 text-gray-500" />
            <span>CASSA</span>
          </button>

          {/* 3. RUBRICA */}
          <button
            onClick={() => handleNavigate('rubrica')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'rubrica' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <BookUser className="w-4 h-4 text-gray-500" />
            <span>RUBRICA</span>
          </button>

          {/* 4. PROMOZIONI */}
          <button
            onClick={() => handleNavigate('promozioni')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'promozioni' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Tag className="w-4 h-4 text-gray-500" />
            <span>PROMOZIONI</span>
          </button>

          {/* 5. MASTERCLASS */}
          <button
            onClick={() => handleNavigate('masterclass')}
            className={`w-full flex items-center justify-between px-3 py-2.5 rounded-lg transition ${
              currentSection === 'masterclass' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <div className="flex items-center gap-3.5">
              <PlayCircle className="w-4 h-4 text-gray-500" />
              <span>MASTERCLASS</span>
            </div>
            <span className="bg-tw-blue text-white text-[9px] font-bold px-1.5 py-0.5 rounded-md lowercase tracking-normal">
              nuovo
            </span>
          </button>

          {/* 6. MAGAZZINO (Collapsible) */}
          <div>
            <button
              onClick={(e) => toggleSubmenu('magazzino', e)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <Package className="w-4 h-4 text-gray-500" />
                <span>MAGAZZINO</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  openSubmenus.magazzino ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSubmenus.magazzino && (
              <div className="pl-10 pr-2 py-1 flex flex-col gap-1 text-[11px] font-medium text-gray-600 lowercase capitalize">
                <button
                  onClick={() => handleNavigate('magazzino-prodotti')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Prodotti
                </button>
                <button
                  onClick={() => handleNavigate('magazzino-ordini')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Ordini Inviati
                </button>
                <button
                  onClick={() => handleNavigate('magazzino-scadenzario')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Scadenzario
                </button>
              </div>
            )}
          </div>

          {/* 7. COMUNICAZIONI */}
          <button
            onClick={() => handleNavigate('comunicazioni')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'comunicazioni' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Megaphone className="w-4 h-4 text-gray-500" />
            <span>COMUNICAZIONI</span>
          </button>

          {/* 8. SPESE */}
          <button
            onClick={() => handleNavigate('spese')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'spese' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <CircleDollarSign className="w-4 h-4 text-gray-500" />
            <span>SPESE</span>
          </button>

          {/* 9. ORARI (Collapsible) */}
          <div>
            <button
              onClick={(e) => toggleSubmenu('orari', e)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <Clock className="w-4 h-4 text-gray-500" />
                <span>ORARI</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  openSubmenus.orari ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSubmenus.orari && (
              <div className="pl-10 pr-2 py-1 flex flex-col gap-1 text-[11px] font-medium text-gray-600">
                <button
                  onClick={() => handleNavigate('orari')}
                  className={`text-left py-1.5 px-2 rounded transition ${
                    currentSection === 'orari'
                      ? 'bg-tw-blue-light text-tw-blue font-bold'
                      : 'hover:bg-gray-100 hover:text-tw-blue'
                  }`}
                >
                  Orari Salone
                </button>
                <button
                  onClick={() => handleNavigate('orari-aperture')}
                  className={`text-left py-1.5 px-2 rounded transition ${
                    currentSection === 'orari-aperture'
                      ? 'bg-tw-blue-light text-tw-blue font-bold'
                      : 'hover:bg-gray-100 hover:text-tw-blue'
                  }`}
                >
                  Aperture Straordinarie
                </button>
                <button
                  onClick={() => handleNavigate('orari-chiusure')}
                  className={`text-left py-1.5 px-2 rounded transition ${
                    currentSection === 'orari-chiusure'
                      ? 'bg-tw-blue-light text-tw-blue font-bold'
                      : 'hover:bg-gray-100 hover:text-tw-blue'
                  }`}
                >
                  Chiusure Straordinarie
                </button>
              </div>
            )}
          </div>

          {/* 10. TRATTAMENTI */}
          <button
            onClick={() => handleNavigate('trattamenti')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'trattamenti' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Scissors className="w-4 h-4 text-gray-500" />
            <span>TRATTAMENTI</span>
          </button>

          {/* 11. STAFF */}
          <button
            onClick={() => handleNavigate('staff')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'staff' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Users className="w-4 h-4 text-gray-500" />
            <span>STAFF</span>
          </button>

          {/* 12. POSTAZIONI */}
          <button
            onClick={() => handleNavigate('postazioni')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'postazioni' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Armchair className="w-4 h-4 text-gray-500" />
            <span>POSTAZIONI</span>
          </button>

          {/* 13. FORNITORI & PRODUTTORI (Collapsible) */}
          <div>
            <button
              onClick={(e) => toggleSubmenu('fornitori', e)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <Truck className="w-4 h-4 text-gray-500" />
                <span>FORNITORI & PRODUTTORI</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  openSubmenus.fornitori ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSubmenus.fornitori && (
              <div className="pl-10 pr-2 py-1 flex flex-col gap-1 text-[11px] font-medium text-gray-600">
                <button
                  onClick={() => handleNavigate('fornitori')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Fornitori
                </button>
                <button
                  onClick={() => handleNavigate('produttori')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Produttori
                </button>
                <button
                  onClick={() => handleNavigate('spedizioni')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Spedizioni
                </button>
              </div>
            )}
          </div>

          {/* 14. STATISTICHE (Collapsible) */}
          <div>
            <button
              onClick={(e) => toggleSubmenu('statistiche', e)}
              className="w-full flex items-center justify-between px-3 py-2.5 rounded-lg hover:bg-gray-50 transition"
            >
              <div className="flex items-center gap-3.5">
                <LineChart className="w-4 h-4 text-gray-500" />
                <span>STATISTICHE</span>
              </div>
              <ChevronDown
                className={`w-3.5 h-3.5 text-gray-400 transition-transform ${
                  openSubmenus.statistiche ? 'rotate-180' : ''
                }`}
              />
            </button>
            {openSubmenus.statistiche && (
              <div className="pl-10 pr-2 py-1 flex flex-col gap-1 text-[11px] font-medium text-gray-600">
                <button
                  onClick={() => handleNavigate('statistiche-andamento')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Analisi Andamento
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-azienda')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Report Azienda
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-corrispettivi')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Corrispettivi
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-collaboratori')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Report Collaboratori
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-clienti')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Report Clienti
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-magazzino')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Report Magazzino
                </button>
                <button
                  onClick={() => handleNavigate('statistiche-inventario')}
                  className="text-left py-1.5 px-2 rounded hover:bg-gray-100 hover:text-tw-blue"
                >
                  Inventario
                </button>
              </div>
            )}
          </div>

          {/* 15. RECENSIONI */}
          <button
            onClick={() => handleNavigate('recensioni')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection === 'recensioni' ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <Star className="w-4 h-4 text-gray-500" />
            <span>RECENSIONI</span>
          </button>

          {/* 16. PROFILO */}
          <button
            onClick={() => handleNavigate('profilo')}
            className={`w-full flex items-center gap-3.5 px-3 py-2.5 rounded-lg transition ${
              currentSection.startsWith('profilo') ? 'bg-tw-blue-light text-tw-blue' : 'hover:bg-gray-50'
            }`}
          >
            <UserCircle className="w-4 h-4 text-gray-500" />
            <span>PROFILO</span>
          </button>
        </nav>
      </div>
    </div>
  );
};
