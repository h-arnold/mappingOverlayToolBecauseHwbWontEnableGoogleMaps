import Papa from 'papaparse';
import L from 'leaflet';
import { layersRegistry, registerLayer, renderActiveLayersUI } from './map.js';
import { constructHeatmapGradient, randomHexColor } from './utils.js';
import { dispatchNotification } from './notifications.js';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

/** @type {Array<Record<string,string>>|null} */
let pendingCsvDataset = null;
let activeWizardType = 'pins';

/* ------------------------------------------------------------------ */
/*  Drag-and-drop + file-picker setup                                  */
/* ------------------------------------------------------------------ */

export function setupFileUpload() {
    const dropzone = document.getElementById('dropzone');
    const fileInput = document.getElementById('csvFileInput');
    if (!dropzone || !fileInput) return;

    ['dragenter', 'dragover'].forEach((name) => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.add('border-indigo-500', 'bg-indigo-950/20');
        });
    });
    ['dragleave', 'drop'].forEach((name) => {
        dropzone.addEventListener(name, (e) => {
            e.preventDefault();
            dropzone.classList.remove('border-indigo-500', 'bg-indigo-950/20');
        });
    });

    dropzone.addEventListener('drop', (e) => {
        const file = e.dataTransfer?.files?.[0];
        if (file) processUploadedCSV(file);
    });

    dropzone.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', () => {
        if (fileInput.files?.[0]) processUploadedCSV(fileInput.files[0]);
        fileInput.value = '';
    });
}

/* ------------------------------------------------------------------ */
/*  CSV processing                                                     */
/* ------------------------------------------------------------------ */

function processUploadedCSV(file) {
    if (!file.name.toLowerCase().endsWith('.csv')) {
        dispatchNotification('Invalid File Type', 'Please upload a file ending with the .csv extension.', 'error');
        return;
    }

    const baseName = file.name.replace(/\.[^/.]+$/, '');
    if (layersRegistry.some((l) => l.name.toLowerCase() === baseName.toLowerCase())) {
        dispatchNotification(
            'Duplicate Layer Name',
            `A layer named "${baseName}" already exists. Rename the existing layer or rename your CSV file.`,
            'error'
        );
        return;
    }

    Papa.parse(file, {
        header: true,
        skipEmptyLines: true,
        complete(result) {
            if (result.errors.length > 0 && result.data.length === 0) {
                dispatchNotification('Parsing Failed', 'The file content could not be read cleanly.', 'error');
                return;
            }
            launchConfigurationWizard(file.name, result.data);
        },
        error(err) {
            dispatchNotification('Parsing Failure', err.message, 'error');
        },
    });
}

/* ------------------------------------------------------------------ */
/*  Wizard                                                             */
/* ------------------------------------------------------------------ */

function launchConfigurationWizard(fileName, dataRows) {
    pendingCsvDataset = dataRows;

    const sampleKeys = Object.keys(dataRows[0] || {});
    const latRe = /^(lat|latitude|y_coord|latitud|northings)$/i;
    const lngRe = /^(lng|longitude|lon|x_coord|longitud|eastings|long)$/i;

    let matchedLat = '';
    let matchedLng = '';
    for (const k of sampleKeys) {
        if (!matchedLat && latRe.test(k.trim())) matchedLat = k;
        if (!matchedLng && lngRe.test(k.trim())) matchedLng = k;
    }
    if (!matchedLat && sampleKeys.length > 0) matchedLat = sampleKeys[0];
    if (!matchedLng && sampleKeys.length > 1) matchedLng = sampleKeys[1];

    const latSel = document.getElementById('wizardLatCol');
    const lngSel = document.getElementById('wizardLngCol');
    if (!latSel || !lngSel) return;

    latSel.innerHTML = '';
    lngSel.innerHTML = '';

    for (const h of sampleKeys) {
        const o1 = document.createElement('option');
        o1.value = h;
        o1.textContent = h;
        if (h === matchedLat) o1.selected = true;
        latSel.appendChild(o1);

        const o2 = document.createElement('option');
        o2.value = h;
        o2.textContent = h;
        if (h === matchedLng) o2.selected = true;
        lngSel.appendChild(o2);
    }

    document.getElementById('wizardLayerName').value = fileName.replace(/\.[^/.]+$/, '');
    setWizardType('pins');

    const color = randomHexColor();
    document.getElementById('wizardColor').value = color;
    document.getElementById('wizardColorLabel').textContent = color.toUpperCase();

    document.getElementById('wizardPanel').classList.remove('hidden');
    dispatchNotification('CSV Data Parsed', `Mapped ${dataRows.length} source records. Confirm columns to generate overlay.`, 'success');
}

/**
 * Programmatically inject data into the wizard (used by mock data loader).
 * @param {string} fileName
 * @param {Array<Record<string,string>>} dataRows
 */
export function injectMockData(fileName, dataRows) {
    launchConfigurationWizard(fileName, dataRows);
}

export function cancelWizard() {
    document.getElementById('wizardPanel')?.classList.add('hidden');
    pendingCsvDataset = null;
}

export function setWizardType(type) {
    activeWizardType = type;
    const btnPins = document.getElementById('btnTypePins');
    const btnHeat = document.getElementById('btnTypeHeat');
    if (!btnPins || !btnHeat) return;

    const activeClass =
        'flex-1 py-1 rounded text-xs font-semibold text-center transition-all bg-indigo-600 text-white shadow-sm';
    const inactiveClass =
        'flex-1 py-1 rounded text-xs font-semibold text-center transition-all text-slate-400 hover:text-slate-200';

    btnPins.className = type === 'pins' ? activeClass : inactiveClass;
    btnHeat.className = type === 'heat' ? activeClass : inactiveClass;
}

/* ------------------------------------------------------------------ */
/*  Wizard controls                                                    */
/* ------------------------------------------------------------------ */

export function setupWizardControls() {
    document.getElementById('btnTypePins')?.addEventListener('click', () => setWizardType('pins'));
    document.getElementById('btnTypeHeat')?.addEventListener('click', () => setWizardType('heat'));
    document.getElementById('btnCancelWizard')?.addEventListener('click', cancelWizard);
    document.getElementById('btnPlotLayer')?.addEventListener('click', compileAndAddLayer);

    document.getElementById('wizardColor')?.addEventListener('input', (e) => {
        const label = document.getElementById('wizardColorLabel');
        if (label) label.textContent = e.target.value.toUpperCase();
    });
}

/* ------------------------------------------------------------------ */
/*  Compile & plot                                                     */
/* ------------------------------------------------------------------ */

export function compileAndAddLayer() {
    if (!pendingCsvDataset) return;

    const name = (document.getElementById('wizardLayerName')?.value || '').trim() || 'Custom Dataset Overlay';
    const colLat = document.getElementById('wizardLatCol')?.value;
    const colLng = document.getElementById('wizardLngCol')?.value;
    const colorHex = document.getElementById('wizardColor')?.value || '#6366f1';
    const visualStyle = activeWizardType;

    if (!colLat || !colLng) {
        dispatchNotification('Missing Columns', 'Please select both latitude and longitude columns.', 'error');
        return;
    }

    if (layersRegistry.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
        dispatchNotification(
            'Duplicate Layer Name',
            `An active layer named "${name}" already exists. Choose a unique name.`,
            'error'
        );
        return;
    }

    const mappedPoints = [];
    let skipped = 0;

    for (const row of pendingCsvDataset) {
        const rawLat = row[colLat];
        const rawLng = row[colLng];
        if (rawLat == null || rawLng == null) {
            skipped++;
            continue;
        }
        const lat = parseFloat(String(rawLat).replace(/[^\d.-]/g, ''));
        const lng = parseFloat(String(rawLng).replace(/[^\d.-]/g, ''));
        if (!isNaN(lat) && !isNaN(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180) {
            mappedPoints.push({ lat, lng, attributes: row });
        } else {
            skipped++;
        }
    }

    if (mappedPoints.length === 0) {
        dispatchNotification('No Valid Points', 'No valid geographic coordinates found in selection.', 'error');
        return;
    }

    let nativeLayer;

    if (visualStyle === 'pins') {
        const group = L.layerGroup();
        for (const pt of mappedPoints) {
            const marker = L.circleMarker([pt.lat, pt.lng], {
                radius: 6,
                fillColor: colorHex,
                color: '#020617',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.85,
            });

            let html = `<div class="p-2 space-y-1 max-h-[180px] overflow-y-auto font-sans text-xs">`;
            html += `<div class="font-bold border-b border-slate-700 pb-1.5 mb-2 flex items-center gap-1.5 text-slate-300"><i data-lucide="info" class="w-3.5 h-3.5 text-indigo-400"></i> Entity Attributes</div>`;
            for (const [k, v] of Object.entries(pt.attributes)) {
                html += `<div class="flex flex-col gap-0.5"><span class="text-slate-500 font-semibold uppercase text-[9px] tracking-wider">${k}</span><span class="text-slate-200 font-mono select-all">${v}</span></div>`;
            }
            html += `</div>`;

            marker.bindPopup(html, { maxWidth: 280 });
            group.addLayer(marker);
        }
        nativeLayer = group;
    } else {
        const coords = mappedPoints.map((p) => [p.lat, p.lng, 0.85]);
        nativeLayer = L.heatLayer(coords, {
            radius: 20,
            blur: 15,
            maxZoom: 15,
            gradient: constructHeatmapGradient(colorHex),
        });
    }

    registerLayer(name, visualStyle, colorHex, mappedPoints, nativeLayer);
    cancelWizard();
    renderActiveLayersUI();
    dispatchNotification('Overlay Plotted', `"${name}" loaded (${mappedPoints.length} points, ${skipped} skipped).`, 'success');
}
