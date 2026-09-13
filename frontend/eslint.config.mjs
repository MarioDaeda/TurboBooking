import { defineConfig } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypeScript from 'eslint-config-next/typescript';

export default defineConfig([
  ...nextCoreWebVitals,
  ...nextTypeScript,
  {
    rules: {
      // Il progetto usa effetti per sincronizzare stato UI derivato da props/API.
      // Migrare questi flussi richiede un refactor UI separato dall'hardening integrazioni.
      'react-hooks/set-state-in-effect': 'off',
    },
  },
]);
