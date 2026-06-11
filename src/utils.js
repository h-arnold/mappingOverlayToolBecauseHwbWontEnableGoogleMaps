/**
 * Convert a hex color string to RGB components.
 * @param {string} hex - e.g. "#6366f1"
 * @returns {{ r: number, g: number, b: number }}
 */
export function convertHexToRGB(hex) {
    const r = parseInt(hex.slice(1, 3), 16);
    const g = parseInt(hex.slice(3, 5), 16);
    const b = parseInt(hex.slice(5, 7), 16);
    return { r, g, b };
}

/**
 * Build a heatmap gradient object from a hex color.
 * @param {string} hexColor
 * @returns {Record<number, string>}
 */
export function constructHeatmapGradient(hexColor) {
    const rgb = convertHexToRGB(hexColor);
    return {
        0.25: `rgba(${Math.max(0, rgb.r - 80)}, ${Math.min(255, rgb.g + 50)}, ${Math.min(255, rgb.b + 100)}, 0.3)`,
        0.55: `rgba(${Math.min(255, rgb.r + 50)}, ${Math.min(255, rgb.g + 100)}, ${Math.max(0, rgb.b - 80)}, 0.6)`,
        0.85: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 0.85)`,
        1.00: `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, 1.0)`,
    };
}

/**
 * Pick a random colour from a curated palette.
 * @returns {string}
 */
export function randomHexColor() {
    const colors = ['#6366f1', '#10b981', '#f43f5e', '#f59e0b', '#ec4899', '#06b6d4', '#8b5cf6'];
    return colors[Math.floor(Math.random() * colors.length)];
}
