import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import 'leaflet.heat';
import { createIcons, icons } from 'lucide';
import { DateTime } from 'luxon';
import { constructHeatmapGradient, getGroupStart, getGroupEnd } from './utils.js';
import { dispatchNotification } from './notifications.js';
import {
    createTimelineControl,
    destroyTimelineControl,
    registerTimelineLayer,
    unregisterTimelineLayer,
    hasTimelineLayers,
    updateTimelineActivity,
} from './timeline.js';

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

/** @type {L.Map} */
export let mapInstance;

/** @type {import('./types').LayerMeta[]} */
export const layersRegistry = [];

/* ------------------------------------------------------------------ */
/*  Tile layer definitions & state                                     */
/* ------------------------------------------------------------------ */

/**
 * @typedef {{ url: string, attribution: string, subdomains?: string, maxZoom?: number }} TileDef
 */

/** @type {Object<string, TileDef>} */
const TILE_PROVIDERS = {
    'Voyager': {
        url: 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    },
    'Positron': {
        url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    },
    'Dark Matter': {
        url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>',
        subdomains: 'abcd',
        maxZoom: 20,
    },
    'OpenTopoMap': {
        url: 'https://tile.opentopomap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors, <a href="https://opentopomap.org">OpenTopoMap</a>',
        maxZoom: 17,
    },
    'OSM Standard': {
        url: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
        attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> contributors',
        maxZoom: 19,
    },
    'Esri Street': {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap',
        maxZoom: 20,
    },
    'Esri Topo': {
        url: 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}',
        attribution: '&copy; Esri &mdash; Source: Esri, HERE, Garmin, USGS, Intermap',
        maxZoom: 20,
    },
};

/** @type {L.TileLayer} */
let currentTileLayer;

/* ------------------------------------------------------------------ */
/*  Map initialisation                                                 */
/* ------------------------------------------------------------------ */

export function initializeMainMap() {
    mapInstance = L.map('map', {
        center: [51.505, -0.09],
        zoom: 11,
        zoomControl: false,
    });

    // Add default tile layer (OSM Standard — recommended)
    const def = TILE_PROVIDERS['OSM Standard'];
    currentTileLayer = L.tileLayer(def.url, {
        attribution: def.attribution,
        maxZoom: def.maxZoom,
    }).addTo(mapInstance);

    L.control.zoom({ position: 'topright' }).addTo(mapInstance);

    // Add tile switcher control (bottom-right)
    mapInstance.addControl(new TileSwitcherControl());
}

/* ------------------------------------------------------------------ */
/*  Tile layer switcher control                                        */
/* ------------------------------------------------------------------ */

const TileSwitcherControl = L.Control.extend({
    options: {
        position: 'bottomright',
    },

    onAdd() {
        const container = L.DomUtil.create('div', 'leaflet-control tile-switcher');

        // Toggle button
        const btn = L.DomUtil.create('button', 'tile-switcher-btn', container);
        btn.innerHTML = '<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6l6-3 6 3 6-3v15l-6 3-6-3-6 3z"/><path d="M9 3v15"/><path d="M15 6v15"/></svg>';
        btn.title = 'Switch basemap';

        // Dropdown panel
        const panel = L.DomUtil.create('div', 'tile-switcher-panel', container);
        panel.style.display = 'none';

        // --- Featured section ---
        const featured = [
            { name: 'OSM Standard', html: '<span class="ts-star">&#9733;</span> OSM Standard <span class="ts-badge">recommended</span>' },
            { name: 'Esri Street', html: '<span class="ts-building">&#8962;</span> Esri Street' },
        ];
        for (const f of featured) {
            const item = L.DomUtil.create('button', 'tile-switcher-item ts-featured', panel);
            item.innerHTML = f.html;
            item.dataset.name = f.name;
            if (f.name === 'OSM Standard') item.classList.add('active');
            item.addEventListener('click', () => this._switchTile(f.name, panel));
        }

        // Divider
        L.DomUtil.create('div', 'ts-divider', panel);

        // --- Accordion ---
        const accordionBtn = L.DomUtil.create('button', 'ts-accordion-btn', panel);
        accordionBtn.innerHTML = '&#9656; Other maps <span class="ts-count">5</span>';
        accordionBtn.dataset.open = 'false';

        const accordionBody = L.DomUtil.create('div', 'ts-accordion-body', panel);
        accordionBody.style.display = 'none';

        const otherNames = ['Voyager', 'Positron', 'Dark Matter', 'OpenTopoMap', 'Esri Topo'];
        for (const name of otherNames) {
            const item = L.DomUtil.create('button', 'tile-switcher-item', accordionBody);
            item.textContent = name;
            item.dataset.name = name;
            item.addEventListener('click', () => this._switchTile(name, panel));
        }

        // Accordion toggle
        accordionBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = accordionBtn.dataset.open === 'true';
            accordionBtn.dataset.open = String(!isOpen);
            accordionBtn.innerHTML = isOpen
                ? '&#9656; Other maps <span class="ts-count">5</span>'
                : '&#9662; Other maps <span class="ts-count">5</span>';
            accordionBody.style.display = isOpen ? 'none' : 'block';
        });

        // --- Toggle button ---
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isOpen = panel.style.display === 'block';
            panel.style.display = isOpen ? 'none' : 'block';
            btn.classList.toggle('open', !isOpen);
        });

        // Close panel when clicking outside
        const onDocClick = (e) => {
            if (!container.contains(e.target)) {
                panel.style.display = 'none';
                btn.classList.remove('open');
            }
        };
        document.addEventListener('click', onDocClick);
        this._onDocClick = onDocClick;

        L.DomEvent.disableClickPropagation(container);
        L.DomEvent.disableScrollPropagation(container);

        return container;
    },

    onRemove() {
        if (this._onDocClick) {
            document.removeEventListener('click', this._onDocClick);
        }
    },

    _switchTile(name, panel) {
        const def = TILE_PROVIDERS[name];
        if (!def) return;

        if (currentTileLayer) {
            mapInstance.removeLayer(currentTileLayer);
        }

        currentTileLayer = L.tileLayer(def.url, {
            attribution: def.attribution,
            maxZoom: def.maxZoom,
            ...(def.subdomains ? { subdomains: def.subdomains } : {}),
        }).addTo(mapInstance);

        // Update active state across all items (featured + accordion)
        panel.querySelectorAll('.tile-switcher-item').forEach((el) => {
            el.classList.toggle('active', el.dataset.name === name);
        });

        // Close panel after selection
        panel.style.display = 'none';
        const btn = panel.parentElement?.querySelector('.tile-switcher-btn');
        if (btn) btn.classList.remove('open');
    },
});

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
 * @returns {import('./types').LayerMeta}
 */
export function registerLayer(name, type, color, coords, nativeLayer) {
    // Defence-in-depth: guard against duplicate names
    if (layersRegistry.some((l) => l.name.toLowerCase() === name.toLowerCase())) {
        dispatchNotification('Duplicate Layer Name', `A layer named "${name}" already exists.`, 'error');
        return null;
    }

    const id = 'overlay_layer_' + crypto.randomUUID();

    /** @type {import('./types').LayerMeta} */
    const meta = {
        id,
        name,
        type,
        color,
        coords,
        nativeLayer,
        visible: true,
        opacity: 1.0,
        radius: 20,
        blur: 15,
        dateColumn: null,
        grouping: null,
        dateRange: null,
        currentWindowStart: null,
        filteredCoords: null,
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

    // Update the toggle icon directly instead of re-rendering the whole list
    const btn = document.querySelector(`.toggle-vis[data-id="${id}"]`);
    if (btn) {
        const icon = btn.querySelector('i');
        if (icon) {
            icon.setAttribute('data-lucide', layer.visible ? 'eye' : 'eye-off');
            icon.className = `w-4 h-4 ${layer.visible ? 'text-indigo-500' : 'text-stone-400'}`;
            // Rebuild the single icon without touching the rest of the DOM
            const parent = icon.parentNode;
            const clone = icon.cloneNode();
            parent.replaceChild(clone, icon);
            createIcons({ icons });
        }
    }
}

/* ------------------------------------------------------------------ */
/*  Delete                                                             */
/* ------------------------------------------------------------------ */

export function dismissLayerFromRegistry(id) {
    const layer = findLayer(id);
    if (!layer) return;

    // Clean up timeline if this layer had it
    if (layer.dateColumn) {
        unregisterTimelineLayer(layer.id);
    }

    mapInstance.removeLayer(layer.nativeLayer);
    layersRegistry.splice(layersRegistry.indexOf(layer), 1);

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
            'bg-white border border-stone-200/80 hover:border-stone-300 rounded-xl p-4 space-y-3.5 transition duration-200 relative group';

        const isPin = layer.type === 'pins';
        const escapedName = layer.name.replace(/"/g, '&quot;');

        card.innerHTML = `
            <div class="flex items-start justify-between gap-2">
                <div class="flex items-center gap-3 flex-1 min-w-0">
                    <button class="p-2 rounded-lg bg-stone-100 hover:bg-stone-200 border border-stone-200 text-stone-500 hover:text-stone-800 transition shadow-sm shrink-0 toggle-vis" data-id="${layer.id}" title="Toggle Display">
                        <i data-lucide="${layer.visible ? 'eye' : 'eye-off'}" class="w-4 h-4 ${layer.visible ? 'text-indigo-500' : 'text-stone-400'}"></i>
                    </button>
                    <div class="flex-1 min-w-0">
                        <div class="flex items-center gap-1.5 group/title">
                            <input type="text"
                                   value="${escapedName}"
                                   class="rename-input bg-transparent border border-transparent hover:border-stone-300 hover:bg-stone-100/80 focus:bg-stone-100 focus:border-indigo-500/50 rounded px-1.5 py-0.5 -ml-1.5 text-sm font-semibold text-stone-700 transition focus:outline-none w-full truncate cursor-pointer focus:cursor-text"
                                   data-id="${layer.id}"
                                   title="Click to rename layer">
                        </div>
                        <span class="text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full ${isPin ? 'bg-indigo-100 text-indigo-600 border border-indigo-200' : 'bg-rose-100 text-rose-600 border border-rose-200'} mt-1 inline-block">
                            ${isPin ? 'Pin Overlay' : 'Heatmap Layer'} &bull; ${layer.coords.length} points
                            ${layer.dateColumn ? `<span class="ml-1 inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-full bg-amber-100 text-amber-700 border border-amber-200 text-[8px] font-bold"><i data-lucide="clock" class="w-2.5 h-2.5"></i> Timeline</span>` : ''}
                    </div>
                </div>
                <button class="p-1.5 rounded-lg text-stone-400 hover:text-rose-500 hover:bg-rose-100 transition shrink-0 delete-layer" data-id="${layer.id}" title="Dismiss Layer">
                    <i data-lucide="trash" class="w-4 h-4"></i>
                </button>
            </div>

            <div class="pt-3.5 border-t border-stone-100 grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Color Shade</label>
                    <div class="flex items-center gap-2 bg-stone-100 rounded-lg px-2.5 py-1.5 border border-stone-200">
                        <input type="color" value="${layer.color}" class="color-picker w-6 h-5 cursor-pointer border-0 rounded bg-transparent" data-id="${layer.id}">
                        <span class="color-hex-label text-xs font-mono text-stone-500 uppercase">${layer.color}</span>
                    </div>
                </div>
                <div>
                    <label class="opacity-label block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1" data-id="${layer.id}">Layer Opacity (${Math.round(layer.opacity * 100)}%)</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-stone-100 rounded-lg border border-stone-200">
                        <input type="range" min="0" max="1" step="0.1" value="${layer.opacity}" class="opacity-slider w-full accent-indigo-500 bg-stone-200 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
            </div>

            ${!isPin ? `
            <div class="pt-2.5 border-t border-stone-100/60 grid grid-cols-2 gap-3">
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Blur Radius (${layer.radius}px)</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-stone-100 rounded-lg border border-stone-200">
                        <input type="range" min="5" max="50" step="1" value="${layer.radius}" class="radius-slider w-full accent-indigo-500 bg-stone-200 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
                <div>
                    <label class="block text-[10px] font-bold uppercase tracking-wider text-stone-400 mb-1">Intensity Blur (${layer.blur}px)</label>
                    <div class="flex items-center gap-2 h-8 px-2 bg-stone-100 rounded-lg border border-stone-200">
                        <input type="range" min="2" max="40" step="1" value="${layer.blur}" class="blur-slider w-full accent-indigo-500 bg-stone-200 h-1 rounded-lg cursor-pointer" data-id="${layer.id}">
                    </div>
                </div>
            </div>
            ` : ''}
        `;

        container.appendChild(card);
    }

    createIcons({ icons });

    // Bind events
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
        inp.addEventListener('input', () => {
            adjustLayerHexColor(inp.dataset.id, inp.value);
            // Update the hex label directly without a full re-render
            const label = inp.parentElement?.querySelector('.color-hex-label');
            if (label) label.textContent = inp.value.toUpperCase();
        });
    });
    container.querySelectorAll('.opacity-slider').forEach((inp) => {
        inp.addEventListener('input', () => {
            adjustLayerOpacity(inp.dataset.id, inp.value);
            // Update the percentage label directly
            const label = document.querySelector(`.opacity-label[data-id="${inp.dataset.id}"]`);
            if (label) label.textContent = `Layer Opacity (${Math.round(parseFloat(inp.value) * 100)}%)`;
        });
    });
    container.querySelectorAll('.radius-slider').forEach((inp) => {
        inp.addEventListener('input', () => adjustHeatmapRadius(inp.dataset.id, inp.value));
    });
    container.querySelectorAll('.blur-slider').forEach((inp) => {
        inp.addEventListener('input', () => adjustHeatmapBlur(inp.dataset.id, inp.value));
    });
}

/* ------------------------------------------------------------------ */
/*  Timeline Integration                                               */
/* ------------------------------------------------------------------ */

/**
 * Initialize the timeline for a layer that has time-series data.
 * @param {import('./types').LayerMeta} meta
 */
export function initializeTimelineForLayer(meta) {
    if (!meta.dateRange) return;

    registerTimelineLayer(meta);

    createTimelineControl(
        mapInstance.getContainer(),
        meta.dateRange.min,
        meta.dateRange.max,
        meta.grouping || 'month',
        (windowStart, grouping) => {
            // Apply the time window to ALL timeline layers
            for (const layer of layersRegistry) {
                if (layer.dateColumn) {
                    updateLayerTimeWindow(layer, windowStart, grouping);
                }
            }
        }
    );

    // Apply initial window
    if (meta.dateRange.min) {
        updateLayerTimeWindow(meta, meta.dateRange.min, meta.grouping || 'month');
    }

    // Refresh activity dots on the slider
    updateTimelineActivity();
}

/**
 * Update a layer to show only points within the specified time window.
 * Rebuilds the native Leaflet layer with only the active (in-window) points.
 * Points without a parsed date are always treated as active.
 * @param {import('./types').LayerMeta} meta
 * @param {import('luxon').DateTime} windowStart
 * @param {string} grouping
 */
export function updateLayerTimeWindow(meta, windowStart, grouping) {
    if (!meta.coords || meta.coords.length === 0) return;

    const windowEnd = getGroupEnd(windowStart, grouping);
    meta.currentWindowStart = windowStart;

    // Filter to only active points (in-window or undated)
    const active = [];
    for (const pt of meta.coords) {
        if (!pt.parsedDate) {
            // Points without a parsed date are always visible
            active.push(pt);
        } else if (pt.parsedDate >= windowStart && pt.parsedDate <= windowEnd) {
            active.push(pt);
        }
        // Points outside the window are simply excluded — no dimmed rendering
    }

    meta.filteredCoords = active;

    // Remove old native layer from map
    if (mapInstance.hasLayer(meta.nativeLayer)) {
        mapInstance.removeLayer(meta.nativeLayer);
    }

    // Rebuild native layer with only active points
    let newLayer;

    if (meta.type === 'pins') {
        const canvasRenderer = L.canvas({ padding: 0.2 });
        const group = L.layerGroup();

        for (const pt of active) {
            const marker = L.circleMarker([pt.lat, pt.lng], {
                renderer: canvasRenderer,
                radius: 6,
                fillColor: meta.color,
                color: '#44403c',
                weight: 1.5,
                opacity: 0.9,
                fillOpacity: meta.opacity,
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
        newLayer = group;
    } else {
        const heatCoords = active.map((p) => [p.lat, p.lng, 0.85]);
        newLayer = L.heatLayer(heatCoords, {
            radius: meta.radius,
            blur: meta.blur,
            maxZoom: 15,
            gradient: constructHeatmapGradient(meta.color),
        });
    }

    meta.nativeLayer = newLayer;

    if (meta.visible) {
        newLayer.addTo(mapInstance);
    }
}
