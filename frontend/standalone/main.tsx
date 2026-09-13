// Punto di ingresso della versione "file unico" (TurboBooking.html): stessa app di src/app/page.tsx,
// con le API servite in memoria da mockApi.ts.
import { createRoot } from 'react-dom/client';
import Home from '@/app/page';
import { installMockApi } from './mockApi';

installMockApi();
createRoot(document.getElementById('root')!).render(<Home />);
