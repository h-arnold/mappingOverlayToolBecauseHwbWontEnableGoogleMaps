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
        ['latitude', 'longditude', 'date/time(optional)', 'optional_meta_data_1', 'optional_metadata_2'],
        ['51.5074', '-0.1278', '2024-03-15 14:30', 'Sensor-A7', 'Firmware v2.1'],
        ['51.4545', '-2.5879', '', 'Sensor-B2', 'Firmware v1.8'],
        ['53.4808', '-2.2426', '2024-06-22 09:15', 'Sensor-C9', 'Firmware v3.0'],
        ['52.4862', '-1.8904', '', 'Sensor-D4', ''],
        ['55.9533', '-3.1883', '2024-09-01 18:45', 'Sensor-E1', 'Firmware v2.5'],
    ];

    const csv = rows.map((r) => r.join(',')).join('\n');
    const href = 'data:text/csv;charset=utf-8,' + encodeURIComponent(csv);

    const a = document.createElement('a');
    a.setAttribute('href', href);
    a.setAttribute('download', 'duckplot_coordinates_template.csv');
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    dispatchNotification('Download Success', 'CSV template has been generated and saved.', 'info');
}
