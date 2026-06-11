/**
 * @typedef {Object} LayerMeta
 * @property {string} id
 * @property {string} name
 * @property {'pins'|'heat'} type
 * @property {string} color
 * @property {Array<{lat:number,lng:number,attributes:Record<string,string>}>} coords
 * @property {import('leaflet').Layer} nativeLayer
 * @property {boolean} visible
 * @property {number} opacity
 * @property {number} radius
 * @property {number} blur
 * @property {string|null} dateColumn - CSV column name for date/time data
 * @property {'hour'|'day'|'week'|'month'|'year'|null} grouping - Time grouping interval
 * @property {{min: import('luxon').DateTime, max: import('luxon').DateTime}|null} dateRange - Min/max parsed dates
 * @property {import('luxon').DateTime|null} currentWindowStart - Current scrubber window start
 * @property {Array<{lat:number,lng:number,attributes:Record<string,string>}>|null} filteredCoords - Subset matching current window
 */

export { };
