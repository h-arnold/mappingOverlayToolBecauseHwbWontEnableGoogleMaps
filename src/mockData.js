import { mapInstance } from './map.js';
import { injectMockData } from './csvHandler.js';
import { dispatchNotification } from './notifications.js';

/**
 * Generate 85 mock data points clustered around the current map centre
 * and feed them into the CSV wizard as if a file had been uploaded.
 */
export function loadSampleDataset() {
    const center = mapInstance.getCenter();

    const rows = [];
    for (let i = 0; i < 85; i++) {
        const latOff = (Math.random() - 0.5) * 0.12;
        const lngOff = (Math.random() - 0.5) * 0.16;

        rows.push({
            Latitude: (center.lat + latOff).toFixed(5),
            Longitude: (center.lng + lngOff).toFixed(5),
            'Record Index': `#SGN-${1000 + i}`,
            'Sensor Strength': Math.floor(Math.random() * 100) + ' dBm',
            'Operational Status': Math.random() > 0.2 ? 'Active Link' : 'Degraded Speed',
        });
    }

    injectMockData('Mock Cellular Signals', rows);
}

/**
 * Download a sample CSV template for students to use as a reference.
 */
export function downloadSampleCSV() {
    const rows = [
        ['latitude', 'longitude', 'node_tag', 'density_scale', 'status'],
        ['51.5074', '-0.1278', 'London Sector Alpha', 'High', 'Active'],
        ['51.4545', '-2.5879', 'Bristol Sector Beta', 'Medium', 'Pending'],
        ['53.4808', '-2.2426', 'Manchester Sector Gamma', 'Low', 'Active'],
        ['52.4862', '-1.8904', 'Birmingham Sector Delta', 'High', 'Inactive'],
        ['55.9533', '-3.1883', 'Edinburgh Sector Epsilon', 'Critical', 'Active'],
    ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

    const a = document.createElement('a');
    a.setAttribute('href', href);
    a.setAttribute('download', 'geoforge_coordinates_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    dispatchNotification('Download Success', 'CSV template has been generated and saved.', 'info');
}
