import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';
import { provideRouter } from '@angular/router';
import { kbqCodeBlockHighlightJsConfigProvider } from '@koobiq/components/code-block';
import { kbqThemeProvider } from '@koobiq/components/core';

import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes),
    kbqThemeProvider({ mode: 'auto', storageKey: 'koobiq-demos-theme' }),
    kbqCodeBlockHighlightJsConfigProvider({
      languages: { css: () => import('highlight.js/lib/languages/css') },
    }),
  ],
};
