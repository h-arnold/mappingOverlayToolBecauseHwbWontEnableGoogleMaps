import L from 'leaflet';
import 'leaflet.heat';
import { createIcons } from 'lucide';
import { constructHeatmapGradient } from './utils.js';
import { dispatchNotification } from './notifications.js';

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

/** @type {L.Map} */
export let mapInstance;

/** @type {Array<import('./types').LayerMeta>} */
export const layersRegistry = [];

/* ------------------------------------------------------------------ */
/*  Map initialisation                                                 */
/* ------------------------------------------------------------------ */

export function initializeMainMap() {
    mapInstance = L.map('map', {
        center: [51.505, -0.09],
        zoom: 11,
        zoomControl: false,
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
        attribution:
            '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    }).addTo(mapInstance);

    L.control.zoom({ position: 'topright' }).addTo(mapInstance);
}

/* ------------------------------------------------------------------ */
/*  Layer management helpers                                           */
/* ------------------------------------------------------------------ */

/**
 * Add a fully-built Leaflet layer to the map and registry.
 * @param {string}            name
 * @param {'pins'|'heat'}     type
 * @param {string}            color
 * @param {Array<{lat:number,lng:number,attributes:Record<string,string>}>} coords
 * @param {L.Layer}           nativeLayer
 */
export function registerLayer(name, type, color, coords, nativeLayer) {
    const id = 'overlay_layer_' + Date.now();

    const meta = {
        id,
        name,
        type,
        color,
        coords,
        nativeLayer,
        visible: true,
        opacity: 0.8,
        radius: 20,
        blur: 15,
    };

    layersRegistry.push(meta);
    nativeLayer.addTo(mapInstance);

    // Fit bounds
    const bounds = L.latLngBounds(coords.map((p) => [p.lat, p.lng]));
    mapInstance.fitBounds(bounds, { padding: [50, 50] });

    return meta;
}

/** Find a layer by id. */
function findLayer(id) {
    return layersRegistry.find((l) => l.id === id);
}

/* ------------------------------------------------------------------ */
/*  Visibility                                                         */
/* ------------------------------------------------------------------ */

export function toggleVisibilityState(id) {
    const layer = findLayer(id);
    if (!layer) return;

    layer.visible = !layer.visible;
    if (layer.visible) {
        layer.nativeLayer.addTo(mapInstance);
        dispatchNotification('Layer Enabled', `Display active for "${layer.name}"`, 'success');
    } else {
        mapInstance.removeLayer(layer.nativeLayer);
        dispatchNotification('Layer Disabled', `Hidden display of "${layer.name}"`, 'info');
    }
    renderActiveLayersUI();
}

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

export function dismissLayerFromRegistry(id) {
    const idx = layersRegistry.findIndex((l) => l.id === id);
    if (idx === -1) return;

    const layer = layersRegistry[idx];
    mapInstance.removeLayer(layer.nativeLayer);
    layersRegistry.splice(idx, 1);

    renderActiveLayersUI();
    dispatchNotification('Layer Removed', `Removed dataset "${layer.name}" completely from session`, 'info');
}

/* ------------------------------------------------------------------ */
/*  Rename                                                             */
/* ------------------------------------------------------------------ */

export function renameLayer(id, newName) {
    const layer = findLayer(id);
    if (!layer) return;

    const clean = newName.trim() || 'Custom Dataset Overlay';
    if (layer.name === clean) return;

    const collision = layersRegistry.some((l) => l.id !== id && l.name.toLowerCase() === clean.toLowerCase());
    if (collision) {
        dispatchNotification('Rename Conflict', `A layer named "${clean}" is already active. Name must be unique.`, 'error');
        renderActiveLayersUI();
        return;
    }

    const old = layer.name;
    layer.name = clean;
    renderActiveLayersUI();
    dispatchNotification('Layer Renamed', `Changed name from "${old}" to "${clean}"`, 'info');
}

/* ------------------------------------------------------------------ */
/*  Style adjustments                                                  */
/* ------------------------------------------------------------------ */

export function adjustLayerHexColor(id, valueHex) {
    const layer = findLayer(id);
    if (!layer) return;

    layer.color = valueHex;

    if (layer.type === 'pins') {
        layer.nativeLayer.eachLayer((circle) => {
            circle.setStyle({ fillColor: valueHex });
        });
    } else {
        layer.nativeLayer.setOptions({ gradient: constructHeatmapGradient(valueHex) });
    }
    renderActiveLayersUI();
}

export function adjustLayerOpacity(id, numericValue) {
    const layer = findLayer(id);
    if (!layer) return;

    layer.opacity = parseFloat(numericValue);

    if (layer.type === 'pins') {
        layer.nativeLayer.eachLayer((circle) => {
            circle.setStyle({ fillOpacity: layer.opacity });
        });
    } else {
        layer.nativeLayer.setOptions({ minOpacity: layer.opacity / 1.5 });
    }
}

export function adjustHeatmapRadius(id, pixelValue) {
    const layer = findLayer(id);
    if (!layer) return;

    layer.radius = parseInt(pixelValue, 10);
    layer.nativeLayer.setOptions({ radius: layer.radius });
}

export function adjustHeatmapBlur(id, pixelValue) {
    const layer = findLayer(id);
    if (!layer) return;

    layer.blur = parseInt(pixelValue, 10);
    layer.nativeLayer.setOptions({ blur: layer.blur });
}

/* ------------------------------------------------------------------ */
/*  Render sidebar cards                                               */
/* ------------------------------------------------------------------ */

export function renderActiveLayersUI() {
    const container = document.getElementById('layersList');
    const emptyState = document.getElementById('layersEmptyState');
    const counter = document.getElementById('layerCounter');
    if (!container || !emptyState || !counter) return;

    counter.textContent = `${layersRegistry.length} Layer${layersRegistry.length === 1 ? '' : 's'}`;

    if (layersRegistry.length === 0) {
        container.classList.add('hidden');
        emptyState.classList.remove('hidden');
        return;
    }

    emptyState.classList.add('hidden');
    container.classList.remove('hidden');
    container.innerHTML = '';

    for (const layer of layersRegistry) {
        const card = document.createElement('div');
        card.className =
            'bg-slate-950 border border-slate-800/80 hover:border-slate-700 rounded-xl p-4 space-y-3.5 transition duration-200 relative group';

        const isPin = layer.type === 'pins';
        const escapedName = layer.name.replace(/"/g, '&quot;');

        card.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <button class="p-2 rounded-lg bg-slate-900 hover:bg-slate-800 border border-slate-800 text-slate-400 hover:text-white transition shadow-sm shrink-0 toggle-vis" data-id="${layer.id}" title="Toggle Display">
                        <i data-lucide="${layer.visible ? 'eye' : 'eye-off'}" class="w-4 h-4 ${layer.visible ? 'text-indigo-400' : 'text-slate-500'}"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 group/title">
                            <input type="text"
                                   value="${escapedName}"
                                   class="rename-input bg-transparent border border-transparent hover:border-slate-800 hover:bg-slate-900/60 focus:bg-slate-900 focus:border-indigo-500/50 rounded px-1.5 py-0.5 -ml-1.5 text-sm font-semibold text-slate-200 transition focus:outline-none w-full truncate cursor-pointer focus:cursor-text"
                                   data-id="${layer.id}"
                                   title="Click to rename layer">
                        </div>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isPin ? 'bg-indigo-500/10 text-indigo-400 border border-indigo-500/20' : 'bg-rose-500/10 text-rose-400 border border-rose-500/20'} mt-1 inline-block">
                            ${isPin ? 'Pin Overlay' : 'Heatmap Layer'} &bull; ${layer.coords.length} points
                        </span>
                    </div>
                </div>
                <button class="p-1.5 rounded-lg text-slate-500 hover:text-rose-400 hover:bg-rose-500/10 transition shrink-0 delete-layer" data-id="${layer.id}" title="Dismiss Layer">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="pt-3.5 border-t border-slate-900 grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Color Shade</label>
                    <div class="flex items-center gap-2 bg-slate-900 rounded-lg px-2.5 py-1.5 border border-slate-800">
                        <input type="color" value="${layer.color}" class="color-picker w-6 h-5 cursor-pointer border-0 rounded bg-transparent" data-id="${layer.id}">
                        <span class="text-xs font-mono text-slate-400 uppercase">${layer.color}</span>
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Layer Opacity</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-slate-900 rounded-lg border border-slate-800">
                        <input type="range" min="0" max="1" step="0.1" value="${layer.opacity}" class="opacity-slider w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
            </div>

            ${!isPin ? `
            <div class="pt-2.5 border-t border-slate-900/60 grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Blur Radius (${layer.radius}px)</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-slate-900 rounded-lg border border-slate-800">
                        <input type="range" min="5" max="50" step="1" value="${layer.radius}" class="radius-slider w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-slate-500 mb-1">Intensity Blur (${layer.blur}px)</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-slate-900 rounded-lg border border-slate-800">
                        <input type="range" min="2" max="40" step="1" value="${layer.blur}" class="blur-slider w-full accent-indigo-500 bg-slate-950 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
            </div>
            ` : ''}
        `;

        container.appendChild(card);
    }

    createIcons();

    // Bind events (delegation would be cleaner but this is straightforward)
    container.querySelectorAll('.toggle-vis').forEach((btn) => {
        btn.addEventListener('click', () => toggleVisibilityState(btn.dataset.id));
    });
    container.querySelectorAll('.delete-layer').forEach((btn) => {
        btn.addEventListener('click', () => dismissLayerFromRegistry(btn.dataset.id));
    });
    container.querySelectorAll('.rename-input').forEach((inp) => {
        inp.addEventListener('change', () => renameLayer(inp.dataset.id, inp.value));
    });
    container.querySelectorAll('.color-picker').forEach((inp) => {
        inp.addEventListener('input', () => adjustLayerHexColor(inp.dataset.id, inp.value));
    });
    container.querySelectorAll('.opacity-slider').forEach((inp) => {
        inp.addEventListener('input', () => adjustLayerOpacity(inp.dataset.id, inp.value));
    });
    container.querySelectorAll('.radius-slider').forEach((inp) => {
        inp.addEventListener('input', () => adjustHeatmapRadius(inp.dataset.id, inp.value));
    });
    container.querySelectorAll('.blur-slider').forEach((inp) => {
        inp.addEventListener('input', () => adjustHeatmapBlur(inp.dataset.id, inp.value));
    });
}
