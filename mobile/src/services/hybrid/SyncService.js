import { hybridCache, CACHE_KEYS } from './CacheService';

class SyncService {
    constructor() {
        this.spreadsheetId = '1MtFaLJAr8u96jQ39lbDUGS_M-UDINk08mx6Cmw5yb_Y';
        this.range = 'Sheet1!A:Z';
        this.apiKey = null;
    }

    configure(config) {
        this.spreadsheetId = config.spreadsheetId;
        this.apiKey = config.apiKey;
        if (config.range) this.range = config.range;
    }

    /**
     * Primary: Google Sheets API v4
     */
    async fetchViaAPI() {
        if (!this.spreadsheetId || !this.apiKey) throw new Error('API config missing');

        const url = `https://sheets.googleapis.com/v4/spreadsheets/${this.spreadsheetId}/values/${this.range}?key=${this.apiKey}`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.error) throw new Error(data.error.message);

        // Transform rows to objects
        const [headers, ...rows] = data.values;
        return rows.map(row => {
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = row[index];
            });
            return obj;
        });
    }

    /**
     * Fallback 1: Visualization API (no API key needed for public sheets)
     */
    async fetchViaVisualization() {
        if (!this.spreadsheetId) throw new Error('Spreadsheet ID missing');

        const url = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/gviz/tq?tqx=out:json`;
        const response = await fetch(url);
        const text = await response.text();

        // Remove the google.visualization.Query.setResponse() wrapper
        const jsonData = JSON.parse(text.substring(text.indexOf('{'), text.lastIndexOf('}') + 1));

        const headers = jsonData.table.cols.map(col => col.label);
        return jsonData.table.rows.map(row => {
            const obj = {};
            row.c.forEach((cell, index) => {
                obj[headers[index]] = cell ? cell.v : null;
            });
            return obj;
        });
    }

    /**
     * Fallback 2: Published CSV
     */
    async fetchViaCSV() {
        if (!this.spreadsheetId) throw new Error('Spreadsheet ID missing');

        const url = `https://docs.google.com/spreadsheets/d/${this.spreadsheetId}/export?format=csv`;
        const response = await fetch(url);
        const csvText = await response.text();

        const lines = csvText.split('\n');
        const headers = lines[0].split(',').map(h => h.trim());

        return lines.slice(1).map(line => {
            const values = line.split(',');
            const obj = {};
            headers.forEach((header, index) => {
                obj[header] = values[index] ? values[index].trim() : null;
            });
            return obj;
        });
    }

    /**
     * Unified sync with retries and fallbacks
     */
    async sync(force = false) {
        console.log('[SyncService] Starting sync...');

        // Check if sync is needed (every 6 hours)
        if (!force) {
            const metadata = await hybridCache.getMetadata(CACHE_KEYS.RECIPES);
            if (metadata) {
                const sixHoursInMs = 6 * 60 * 60 * 1000;
                if (Date.now() - metadata.timestamp < sixHoursInMs) {
                    console.log('[SyncService] Sync skipped (last sync was less than 6 hours ago)');
                    return null;
                }
            }
        }

        const methods = [
            this.fetchViaAPI.bind(this),
            this.fetchViaVisualization.bind(this),
            this.fetchViaCSV.bind(this)
        ];

        for (const method of methods) {
            try {
                const recipes = await method();
                if (recipes && recipes.length > 0) {
                    console.log(`[SyncService] Successfully synced ${recipes.length} recipes using ${method.name}`);

                    // Standardize if needed (handling stringified arrays etc)
                    const standardized = recipes.map(r => ({
                        ...r,
                        ingredients: typeof r.ingredients === 'string' ? r.ingredients.split(';').map(i => i.trim()) : r.ingredients,
                        isLocal: false,
                        id: r.id || `remote_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
                    }));

                    await hybridCache.set(CACHE_KEYS.RECIPES, standardized, {
                        source: 'remote',
                        version: Date.now().toString()
                    });

                    return standardized;
                }
            } catch (error) {
                console.warn(`[SyncService] Method ${method.name} failed:`, error.message);
                continue;
            }
        }

        throw new Error('All sync methods failed');
    }
}

export const hybridSync = new SyncService();
