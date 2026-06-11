import Papa from 'papaparse';
import L from 'leaflet';
import 'leaflet.heat';
import { DateTime } from 'luxon';
import { layersRegistry, registerLayer, renderActiveLayersUI, initializeTimelineForLayer } from './map.js';
import { constructHeatmapGradient, getGroupStart, getGroupEnd } from './utils.js';
import { dispatchNotification } from './notifications.js';

/* ------------------------------------------------------------------ */
/*  State                                                              */
/* ------------------------------------------------------------------ */

/** @type {Array<Record<string,string>>|null} */
let pendingCsvDataset = null;
let activeWizardType = 'pins';
let activeTimelineGroup = 'month';

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

    // Populate date column dropdown
    const dateSel = document.getElementById('wizardDateCol');
    if (dateSel) {
        dateSel.innerHTML = '<option value="">— Select column —</option>';
        const dateRe = /(date|time|month|year|timestamp|period)/i;
        let matchedDate = '';
        for (const h of sampleKeys) {
            const o = document.createElement('option');
            o.value = h;
            o.textContent = h;
            if (dateRe.test(h.trim()) && !matchedDate) matchedDate = h;
            if (h === matchedDate) o.selected = true;
            dateSel.appendChild(o);
        }
    }

    // Reset timeline checkbox
    const chkTimeline = document.getElementById('chkTimeline');
    if (chkTimeline) chkTimeline.checked = false;
    const timelineOptions = document.getElementById('timelineOptions');
    if (timelineOptions) timelineOptions.classList.add('hidden');

    document.getElementById('wizardColor').value = '#ff0000';
    document.getElementById('wizardColorLabel').textContent = '#FF0000';

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
        'flex-1 py-1 rounded text-xs font-semibold text-center transition-all text-stone-500 hover:text-stone-700';

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

    // Timeline checkbox toggle
    document.getElementById('chkTimeline')?.addEventListener('change', (e) => {
        const timelineOptions = document.getElementById('timelineOptions');
        if (timelineOptions) {
            timelineOptions.classList.toggle('hidden', !e.target.checked);
        }
    });

    // Timeline group buttons
    document.querySelectorAll('.timeline-group-btn').forEach((btn) => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.timeline-group-btn').forEach((b) => {
                b.className =
                    'timeline-group-btn flex-1 py-1.5 rounded text-[11px] font-semibold text-center transition-all text-stone-500 hover:text-stone-700';
            });
            btn.className =
                'timeline-group-btn flex-1 py-1.5 rounded text-[11px] font-semibold text-center transition-all bg-indigo-600 text-white shadow-sm';
            activeTimelineGroup = btn.dataset.group;
        });
    });
}

/* ------------------------------------------------------------------ */
/*  Date parsing helpers                                               */
/* ------------------------------------------------------------------ */

/**
 * Try to parse a date string into a luxon DateTime using multiple strategies.
 * @param {string} raw
 * @returns {import('luxon').DateTime|null}
 */
function parseDateString(raw) {
    if (!raw || typeof raw !== 'string') return null;
    const trimmed = raw.trim();
    if (!trimmed) return null;

    // ISO 8601
    let dt = DateTime.fromISO(trimmed);
    if (dt.isValid) return dt;

    // Common CSV date formats
    const formats = [
        'yyyy-MM-dd HH:mm:ss',
        'yyyy-MM-dd HH:mm',
        'yyyy-MM-dd',
        'yyyy/MM/dd',
        'dd/MM/yyyy HH:mm:ss',
        'dd/MM/yyyy HH:mm',
        'dd/MM/yyyy',
        'MM/dd/yyyy HH:mm:ss',
        'MM/dd/yyyy HH:mm',
        'MM/dd/yyyy',
        'yyyy-MM',           // e.g. 2022-01
        'yyyy/MM',
        'MMM yyyy',          // e.g. Jan 2022
        'MMMM yyyy',         // e.g. January 2022
        'dd-MMM-yyyy',       // e.g. 01-Jan-2022
        'yyyyMMdd',
        'HH:mm:ss',
        'HH:mm',
    ];

    for (const fmt of formats) {
        dt = DateTime.fromFormat(trimmed, fmt);
        if (dt.isValid) return dt;
    }

    return null;
}

/* ------------------------------------------------------------------ */
/*  Compile & plot                                                     */
/* ------------------------------------------------------------------ */

export function compileAndAddLayer() {
    if (!pendingCsvDataset) return;

    const name = (document.getElementById('wizardLayerName')?.value || '').trim() || 'Custom Dataset Overlay';
    const colLat = document.getElementById('wizardLatCol')?.value;
    const colLng = document.getElementById('wizardLngCol')?.value;
    const colorHex = document.getElementById('wizardColor')?.value || '#ff0000';
    const visualStyle = activeWizardType;

    const chkTimeline = /** @type {HTMLInputElement} */ (document.getElementById('chkTimeline'));
    const useTimeline = chkTimeline?.checked || false;
    const dateColumn = useTimeline ? document.getElementById('wizardDateCol')?.value || null : null;
    const grouping = useTimeline ? activeTimelineGroup : null;

    if (!colLat || !colLng) {
        dispatchNotification('Missing Columns', 'Please select both latitude and longitude columns.', 'error');
        return;
    }

    if (useTimeline && !dateColumn) {
        dispatchNotification('Missing Date Column', 'Please select a date/time column or disable the timeline.', 'error');
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
    let badDate = 0;
    /** @type {import('luxon').DateTime[]} */
    const allDates = [];

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
            const pt = { lat, lng, attributes: row };
            if (useTimeline && dateColumn && row[dateColumn] != null) {
                const parsed = parseDateString(row[dateColumn]);
                if (parsed && parsed.isValid) {
                    pt.parsedDate = parsed;
                    allDates.push(parsed);
                } else {
                    badDate++;
                }
            }
            mappedPoints.push(pt);
        } else {
            skipped++;
        }
    }

    if (mappedPoints.length === 0) {
        dispatchNotification('No Valid Points', 'No valid geographic coordinates found in selection.', 'error');
        return;
    }

    if (useTimeline && allDates.length === 0) {
        dispatchNotification(
            'No Parseable Dates',
            'Could not parse any dates from the selected column. Please check the format or disable timeline.',
            'error'
        );
        return;
    }

    if (useTimeline && badDate > 0) {
        dispatchNotification(
            'Date Parsing Warning',
            `${badDate} row(s) had unparseable dates and were excluded from timeline filtering.`,
            'info'
        );
    }

    // Compute date range from parsed dates
    let dateRange = null;
    if (useTimeline && allDates.length > 0) {
        allDates.sort((a, b) => a.toMillis() - b.toMillis());
        dateRange = { min: allDates[0], max: allDates[allDates.length - 1] };
    }

    let nativeLayer;

    if (visualStyle === 'pins') {
        const canvasRenderer = L.canvas({ padding: 0.2 });
        const group = L.layerGroup();
        for (const pt of mappedPoints) {
            const marker = L.circleMarker([pt.lat, pt.lng], {
                renderer: canvasRenderer,
                radius: 6,
                fillColor: colorHex,
                color: '#44403c',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: 0.85,
            });

            let html = `<div class="p-2 space-y-1 max-h-[180px] overflow-y-auto font-sans text-xs">`;
            html += `<div class="font-bold border-b border-stone-200 pb-1.5 mb-2 flex items-center gap-1.5 text-stone-600"><i data-lucide="info" class="w-3.5 h-3.5 text-indigo-500"></i> Entity Attributes</div>`;
            for (const [k, v] of Object.entries(pt.attributes)) {
                html += `<div class="flex flex-col gap-0.5"><span class="text-stone-400 font-semibold uppercase text-[9px] tracking-wider">${k}</span><span class="text-stone-700 font-mono select-all">${v}</span></div>`;
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
            minOpacity: 0.67,
            gradient: constructHeatmapGradient(colorHex),
        });
    }

    const registered = registerLayer(name, visualStyle, colorHex, mappedPoints, nativeLayer);
    if (!registered) return;

    // Set timeline metadata on the registered layer
    if (useTimeline && dateRange) {
        registered.dateColumn = dateColumn;
        registered.grouping = grouping;
        registered.dateRange = dateRange;
        // Store parsed dates on each point
        for (let i = 0; i < registered.coords.length; i++) {
            if (mappedPoints[i]?.parsedDate) {
                registered.coords[i].parsedDate = mappedPoints[i].parsedDate;
            }
        }
        // Initialize the timeline control
        initializeTimelineForLayer(registered);
    }

    cancelWizard();
    renderActiveLayersUI();
    const extra = useTimeline ? `, ${allDates.length} dated` : '';
    dispatchNotification('Overlay Plotted', `"${name}" loaded (${mappedPoints.length} points${extra}, ${skipped} skipped).`, 'success');
}
