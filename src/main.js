import { createIcons, icons } from 'lucide';
import { initializeMainMap } from './map.js';
import { setupFileUpload, setupWizardControls } from './csvHandler.js';
import { loadSampleDataset, downloadSampleCSV } from './mockData.js';

/* ------------------------------------------------------------------ */
/*  Bootstrap                                                          */
/* ------------------------------------------------------------------ */

document.addEventListener('DOMContentLoaded', () => {
    // 1. Initialise the Leaflet map
    initializeMainMap();

    // 2. Set up CSV drag-and-drop / file-picker
    setupFileUpload();

    // 3. Set up wizard controls (type toggle, cancel, plot)
    setupWizardControls();

    // 4. Header buttons
    document.getElementById('btnLoadMock')?.addEventListener('click', loadSampleDataset);
    document.getElementById('btnDownloadSample')?.addEventListener('click', downloadSampleCSV);

    // 5. Render Lucide icons
    createIcons({ icons });
});
