// Picks the AIMS360 data source. Only "demo" exists in this first build;
// "aims360" (live REST API) is the next phase and must expose the same methods.
import { demoProvider } from './demoProvider.js';

export function getProvider() {
  const mode = process.env.AIMS360_MODE || 'demo';
  if (mode !== 'demo') {
    console.warn(`AIMS360_MODE=${mode} is not built yet; using demo data.`);
  }
  return demoProvider;
}
