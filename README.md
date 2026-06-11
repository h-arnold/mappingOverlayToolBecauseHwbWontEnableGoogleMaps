# DuckPlot — A Quacking Overlay Plotter! 🦆🗺️

Upload a CSV of coordinates and overlay **pins** or **heatmaps** onto an interactive map. Built with Leaflet, designed for quick spatial data visualisation — no API keys required.

Created because even after fourteen years of existence [Hwb](https://hwb.gov.wales/) have neither the prodecural or technical ability to enable non-core Google services in Google Workspace for Education accounts, so I couldn't just use Google My Maps.

No data is collected anywhere - everything is proceessed client-side in your browser.

[Use it here](https://h-arnold.github.io/DuckPlot/)

---

## Features

- **Pin overlays** — Drop colour-coded markers for every coordinate in your dataset.
- **Heatmap overlays** — Visualise point density with an adjustable intensity gradient.
- **Timeline scrubbing** — If your data includes a date/time column, enable the timeline to filter points by time window. Group by hour, day, week, month, or year.
- **Multiple layers** — Upload several CSV files; each becomes its own named layer that can be toggled on/off, recoloured, or removed.
- **Multiple basemaps** — Switch between OSM Standard, CARTO (Voyager, Positron, Dark Matter), OpenTopoMap, and Esri basemaps.
- **Sample data** — Click **Load Mock Dataset** to see a demo, or **Sample CSV Template** to download a reference file.

---

## Uploading Data

1. **Prepare a CSV file** — see [CSV column requirements](#csv-column-requirements) below.
2. **Drag & drop** the file onto the import panel, or click to browse.
3. **Configure** the layer in the wizard that appears:
   - Choose the **latitude** and **longitude** columns.
   - Pick an overlay method: **Pins** or **Heatmap**.
   - Set a **base colour** for the layer.
   - Optionally **enable the timeline** if a date/time column is present.
4. Click **Plot Layer** — your data appears on the map.

You can upload multiple CSV files; each becomes a separate layer in the layer list.

---

## CSV Column Requirements

| Column                                                 | Required | Description                                                          |
| ------------------------------------------------------ | -------- | -------------------------------------------------------------------- |
| `latitude` (or `lat`, `y_coord`, etc.)                 | ✅ Yes   | Decimal degrees latitude (e.g. `51.5074`)                            |
| `longitude` (or `lng`, `lon`, `x_coord`, `long`, etc.) | ✅ Yes   | Decimal degrees longitude (e.g. `-0.1278`)                           |
| Date / time column                                     | ❌ No    | If present, you can enable the timeline to filter by time window     |
| Any additional columns                                 | ❌ No    | Extra columns are displayed inside the popup when clicking a map pin |

### Latitude & Longitude

Your CSV **must** include at least two columns containing latitude and longitude values in **decimal degrees**. The wizard will try to auto-detect them by name (e.g. `latitude`, `lat`, `longitude`, `lng`, `lon`, `y_coord`, `x_coord`), but you can override the selection from the dropdown menus.

### Date / Time Column (Optional)

If your CSV includes a column with dates or timestamps, check **Enable Timeline** during configuration. This adds a scrubbable timeline slider beneath the map, letting you step through your data grouped by **hour**, **day**, **week**, **month**, or **year**. Only points falling within the current window are shown.

The parser accepts a wide range of date/time formats (ISO 8601, `YYYY-MM-DD HH:mm`, `DD/MM/YYYY`, etc.).

### Additional Columns (Optional)

Any other columns in your CSV are treated as metadata. When you click a pin on the map, a popup displays the values from every extra column for that row. For example, if your CSV has columns `Sensor Name`, `Reading`, and `Status`, the pin popup will show all three alongside the coordinates.

---

## Tech Stack

- [Leaflet](https://leafletjs.com/) — map rendering
- [Leaflet.heat](https://github.com/Leaflet/Leaflet.heat) — heatmap layer
- [PapaParse](https://www.papaparse.com/) — CSV parsing
- [Luxon](https://moment.github.io/luxon/) — date/time handling
- [Lucide](https://lucide.dev/) — icons
- [Tailwind CSS](https://tailwindcss.com/) — styling
- [Vite](https://vitejs.dev/) — build tool
