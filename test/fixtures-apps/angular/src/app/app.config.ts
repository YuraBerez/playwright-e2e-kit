import { ApplicationConfig, provideBrowserGlobalErrorListeners } from '@angular/core';

// Zoneless (the Angular default): no zone.js, no testability API unless an app adds it.
export const appConfig: ApplicationConfig = {
  providers: [provideBrowserGlobalErrorListeners()],
};
