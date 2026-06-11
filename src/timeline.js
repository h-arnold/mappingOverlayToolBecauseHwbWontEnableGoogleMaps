import { DateTime } from 'luxon';
import { getGroupStart, getGroupEnd } from './utils.js';

/* ------------------------------------------------------------------ */
/*  State                                                             */
/* ------------------------------------------------------------------ */

/** @type {TimelineControl|null} */
let activeControl = null;

/** @type {Array<import('./types').LayerMeta>} */
const timelineLayers = [];

/** @type {Function|null} */
let scrubCallback = null;

/* ------------------------------------------------------------------ */
/*  Timeline Control (appended directly to the map container)          */
/* ------------------------------------------------------------------ */

class TimelineControl {
    constructor(mapContainer) {
        this._mapContainer = mapContainer;
        this._rangeMin = null;
        this._rangeMax = null;
        this._grouping = 'month';
        this._currentStep = 0;
        this._totalSteps = 0;
        this._steps = [];
        this._stepActivity = null;
        this._destroyed = false;

        // Create DOM
        const el = document.createElement('div');
        el.className = 'timeline-control';
        el.innerHTML = `
            <div class="timeline-inner">
                <div class="timeline-gear-area">
                    <button class="timeline-gear-btn" title="Change time grouping">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1 0 2.83 2 2 0 0 1-2.83 0l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-2 2 2 2 0 0 1-2-2v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83 0 2 2 0 0 1 0-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1-2-2 2 2 0 0 1 2-2h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 0-2.83 2 2 0 0 1 2.83 0l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 2-2 2 2 0 0 1 2 2v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 0 2 2 0 0 1 0 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 2 2 2 2 0 0 1-2 2h-.09a1.65 1.65 0 0 0-1.51 1z"/></svg>
                    </button>
                    <div class="timeline-gear-dropdown hidden">
                        <button class="tl-group-opt" data-group="hour">Hour</button>
                        <button class="tl-group-opt" data-group="day">Day</button>
                        <button class="tl-group-opt" data-group="week">Week</button>
                        <button class="tl-group-opt active" data-group="month">Month</button>
                        <button class="tl-group-opt" data-group="year">Year</button>
                    </div>
                </div>
                <span class="timeline-label timeline-label-start">—</span>
                <div class="timeline-slider-wrap">
                    <input type="range" class="timeline-slider" min="0" max="100" value="0" step="1" />
                    <div class="timeline-ticks"></div>
                </div>
                <span class="timeline-label timeline-label-end">—</span>
                <button class="timeline-close-btn" title="Close timeline">
                    <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                </button>
            </div>
        `;

        mapContainer.appendChild(el);
        this._el = el;

        // Store refs
        this._slider = el.querySelector('.timeline-slider');
        this._sliderWrap = el.querySelector('.timeline-slider-wrap');
        this._startLabel = el.querySelector('.timeline-label-start');
        this._endLabel = el.querySelector('.timeline-label-end');
        this._ticksEl = el.querySelector('.timeline-ticks');
        this._gearBtn = el.querySelector('.timeline-gear-btn');
        this._gearDropdown = el.querySelector('.timeline-gear-dropdown');
        this._closeBtn = el.querySelector('.timeline-close-btn');

        this._bindEvents();

        // Reposition ticks when the slider-wrap resizes
        this._resizeObserver = new ResizeObserver(() => {
            this._repositionTicks();
        });
        this._resizeObserver.observe(this._slider.parentElement);
    }

    _bindEvents() {
        this._slider.addEventListener('input', (e) => {
            this._currentStep = parseInt(e.target.value, 10);
            this._updateLabels();
            if (scrubCallback) {
                const winStart = this._getWindowStart();
                scrubCallback(winStart, this._grouping);
            }
        });

        this._gearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this._gearDropdown.classList.toggle('hidden');
        });

        this._gearDropdown.querySelectorAll('.tl-group-opt').forEach((opt) => {
            opt.addEventListener('click', (e) => {
                e.stopPropagation();
                const group = opt.dataset.group;
                if (group && group !== this._grouping) {
                    this._gearDropdown.querySelectorAll('.tl-group-opt').forEach((o) => o.classList.remove('active'));
                    opt.classList.add('active');
                    this._grouping = group;
                    this._rebuildSteps();
                    // Refresh activity dots for the new grouping
                    updateTimelineActivity();
                    // Fire the callback so map layers update with the new grouping
                    if (scrubCallback) {
                        const winStart = this._getWindowStart();
                        scrubCallback(winStart, this._grouping);
                    }
                    this._gearDropdown.classList.add('hidden');
                }
            });
        });

        this._closeBtn.addEventListener('click', () => {
            this._el.classList.add('timeline-hidden');
        });

        document.addEventListener('click', (e) => {
            if (this._gearDropdown && !this._gearDropdown.classList.contains('hidden')) {
                const gearArea = this._el.querySelector('.timeline-gear-area');
                if (gearArea && !gearArea.contains(e.target)) {
                    this._gearDropdown.classList.add('hidden');
                }
            }
        });
    }

    setRange(minDate, maxDate, grouping) {
        this._rangeMin = minDate;
        this._rangeMax = maxDate;
        this._grouping = grouping || 'month';

        this._gearDropdown.querySelectorAll('.tl-group-opt').forEach((o) => {
            o.classList.toggle('active', o.dataset.group === this._grouping);
        });

        this._rebuildSteps();
        this._el.classList.remove('timeline-hidden');
    }

    _rebuildSteps() {
        if (!this._rangeMin || !this._rangeMax) return;

        const start = getGroupStart(this._rangeMin, this._grouping);
        const end = getGroupEnd(this._rangeMax, this._grouping);

        let steps = [];
        let cursor = start;

        const unit = this._grouping === 'hour' ? 'hours'
            : this._grouping === 'day' ? 'days'
                : this._grouping === 'week' ? 'weeks'
                    : this._grouping === 'month' ? 'months'
                        : 'years';

        while (cursor <= end) {
            steps.push(cursor);
            cursor = cursor.plus({ [unit]: 1 });
        }

        this._steps = steps;
        this._totalSteps = Math.max(steps.length - 1, 0);

        if (this._totalSteps === 0) {
            this._currentStep = 0;
            this._slider.max = '0';
            this._slider.value = '0';
            this._renderTicks();
            this._updateLabels();
            return;
        }

        this._currentStep = Math.min(this._currentStep, this._totalSteps);
        this._slider.max = String(this._totalSteps);
        this._slider.value = String(this._currentStep);
        this._renderTicks();
        this._renderActivityDots();
        this._updateLabels();
    }

    _renderTicks() {
        if (!this._steps || this._steps.length < 2) return;

        this._ticksEl.innerHTML = '';

        const maxTicks = Math.min(this._steps.length, 20);
        const interval = Math.max(1, Math.floor((this._steps.length - 1) / (maxTicks - 1)));
        const tickPositions = [];

        for (let i = 0; i < this._steps.length; i += interval) {
            tickPositions.push(i);
        }
        if (tickPositions[tickPositions.length - 1] !== this._steps.length - 1) {
            tickPositions.push(this._steps.length - 1);
        }

        for (const idx of tickPositions) {
            const tick = document.createElement('div');
            tick.className = 'timeline-tick';
            const pct = (idx / Math.max(this._steps.length - 1, 1)) * 100;
            tick.style.left = `${pct}%`;

            const label = document.createElement('span');
            label.className = 'timeline-tick-label';
            label.textContent = this._formatTickDate(this._steps[idx]);
            tick.appendChild(label);

            this._ticksEl.appendChild(tick);
        }

        this._repositionTicks();
    }

    /** Align tick labels vertically to sit below the slider track. */
    _repositionTicks() {
        if (!this._ticksEl || this._ticksEl.children.length === 0) return;

        const sliderRect = this._slider.getBoundingClientRect();
        const ticksRect = this._ticksEl.getBoundingClientRect();
        const sliderCenterY = sliderRect.top - ticksRect.top + sliderRect.height / 2;

        for (const tick of this._ticksEl.children) {
            tick.style.top = `${sliderCenterY}px`;
        }
    }

    _formatTickDate(dt) {
        switch (this._grouping) {
            case 'hour': return dt.toFormat('HH:mm');
            case 'day': return dt.toFormat('d MMM');
            case 'week': return dt.toFormat('d MMM');
            case 'month': return dt.toFormat('MMM yyyy');
            case 'year': return dt.toFormat('yyyy');
            default: return dt.toFormat('MMM yyyy');
        }
    }

    _formatWindowDate(dt) {
        switch (this._grouping) {
            case 'hour': return dt.toFormat('d MMM yyyy, HH:mm');
            case 'day': return dt.toFormat('d MMM yyyy');
            case 'week': return dt.toFormat('d MMM yyyy');
            case 'month': return dt.toFormat('MMM yyyy');
            case 'year': return dt.toFormat('yyyy');
            default: return dt.toFormat('MMM yyyy');
        }
    }

    _updateLabels() {
        if (!this._steps || this._steps.length === 0) {
            this._startLabel.textContent = '—';
            this._endLabel.textContent = '—';
            return;
        }

        this._startLabel.textContent = this._formatWindowDate(this._rangeMin);
        this._endLabel.textContent = this._formatWindowDate(this._rangeMax);
    }

    _getWindowStart() {
        if (!this._steps || this._steps.length === 0) return this._rangeMin || DateTime.now();
        return this._steps[Math.min(this._currentStep, this._steps.length - 1)];
    }

    getCurrentWindow() {
        if (!this._rangeMin || !this._rangeMax) return null;
        const start = this._getWindowStart();
        const end = getGroupEnd(start, this._grouping);
        return { start, end: end <= this._rangeMax ? end : this._rangeMax };
    }

    setStep(step) {
        this._currentStep = Math.max(0, Math.min(step, this._totalSteps));
        this._slider.value = String(this._currentStep);
        this._updateLabels();
    }

    show() {
        this._el.classList.remove('timeline-hidden');
    }

    /**
     * Store which time steps have data points and re-render the dots.
     * @param {boolean[]} activity
     */
    setStepActivity(activity) {
        this._stepActivity = activity;
        this._renderActivityDots();
    }

    /** Render tiny dots on the slider for time steps that have data. */
    _renderActivityDots() {
        const existing = this._sliderWrap.querySelector('.timeline-activity-dots');
        if (existing) existing.remove();

        if (!this._stepActivity || !this._steps || this._steps.length < 2) return;

        const container = document.createElement('div');
        container.className = 'timeline-activity-dots';

        const total = this._steps.length - 1;
        for (let i = 0; i < this._stepActivity.length; i++) {
            if (!this._stepActivity[i]) continue;

            const dot = document.createElement('div');
            dot.className = 'timeline-activity-dot';
            // Account for the 16px slider thumb: the thumb center ranges
            // from 8px to (100% - 8px), not 0% to 100%.
            // ratio is unitless so it can multiply a length in calc().
            const ratio = i / total;
            dot.style.left = `calc(${ratio} * (100% - 16px) + 8px)`;
            container.appendChild(dot);
        }

        this._sliderWrap.appendChild(container);
    }

    destroy() {
        if (this._destroyed) return;
        this._destroyed = true;
        this._resizeObserver.disconnect();
        this._el.remove();
    }
}

/* ------------------------------------------------------------------ */
/*  Public API                                                         */
/* ------------------------------------------------------------------ */

/**
 * Create and add the timeline control to the map container.
 * @param {HTMLElement} mapContainer - the map's root DOM element
 * @param {DateTime} minDate
 * @param {DateTime} maxDate
 * @param {string} grouping
 * @param {Function} onScrub - callback(startDate, grouping)
 * @returns {TimelineControl}
 */
export function createTimelineControl(mapContainer, minDate, maxDate, grouping, onScrub) {
    if (activeControl) {
        activeControl.setRange(minDate, maxDate, grouping);
        activeControl.show();
        return activeControl;
    }

    scrubCallback = onScrub;
    const ctrl = new TimelineControl(mapContainer);
    ctrl.setRange(minDate, maxDate, grouping);
    activeControl = ctrl;
    return ctrl;
}

/**
 * Destroy the timeline control and remove its DOM element.
 */
export function destroyTimelineControl() {
    if (activeControl) {
        activeControl.destroy();
    }
    activeControl = null;
}

/**
 * Show the timeline control if it exists.
 */
export function showTimelineControl() {
    if (activeControl) activeControl.show();
}

/**
 * Register a layer as having timeline data.
 * @param {import('./types').LayerMeta} meta
 */
export function registerTimelineLayer(meta) {
    if (!timelineLayers.some((l) => l.id === meta.id)) {
        timelineLayers.push(meta);
    }
}

/**
 * Unregister a timeline layer.
 * @param {string} layerId
 */
export function unregisterTimelineLayer(layerId) {
    const idx = timelineLayers.findIndex((l) => l.id === layerId);
    if (idx !== -1) timelineLayers.splice(idx, 1);

    if (timelineLayers.length === 0) {
        destroyTimelineControl();
    } else {
        updateTimelineActivity();
    }
}

/**
 * Get the current scrub window.
 * @returns {{ start: DateTime, end: DateTime }|null}
 */
export function getCurrentWindow() {
    if (activeControl) return activeControl.getCurrentWindow();
    return null;
}

/**
 * Check if there are any active timeline layers.
 * @returns {boolean}
 */
export function hasTimelineLayers() {
    return timelineLayers.length > 0;
}

/**
 * Recompute which time steps have data points across all timeline layers
 * and update the slider activity dots.
 */
export function updateTimelineActivity() {
    if (!activeControl || timelineLayers.length === 0) return;

    const steps = activeControl._steps;
    if (!steps || steps.length === 0) return;

    const grouping = activeControl._grouping;
    const activity = new Array(steps.length).fill(false);

    for (let i = 0; i < steps.length; i++) {
        const winStart = steps[i];
        const winEnd = getGroupEnd(winStart, grouping);

        for (const layer of timelineLayers) {
            if (!layer.coords) continue;
            for (const pt of layer.coords) {
                if (pt.parsedDate && pt.parsedDate >= winStart && pt.parsedDate <= winEnd) {
                    activity[i] = true;
                    break;
                }
            }
            if (activity[i]) break;
        }
    }

    activeControl.setStepActivity(activity);
}
