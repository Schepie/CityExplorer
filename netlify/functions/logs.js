import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { validateUser } from './utils/auth.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// In Netlify Dev, this will likely be the root; in production, logs are ephemeral.
// We target the root service_logs.txt if reachable.
const LOG_FILE = path.join(process.cwd(), 'service_logs.txt');

export const handler = async (event, context) => {
    const { httpMethod, body } = event;

    // 1. Auth Check (Same logic as server.js)
    const auth = validateUser(event);
    if (auth.error) {
        return { statusCode: auth.status, body: JSON.stringify({ error: auth.error }) };
    }

    try {
        if (httpMethod === 'GET') {
            const isDownload = event.path.endsWith('/download');

            if (!fs.existsSync(LOG_FILE)) {
                if (isDownload) return { statusCode: 404, body: "No logs found" };
                return { statusCode: 200, body: JSON.stringify({ logs: "" }) };
            }

            const content = fs.readFileSync(LOG_FILE, 'utf8');

            if (isDownload) {
                return {
                    statusCode: 200,
                    headers: {
                        "Content-Type": "text/plain",
                        "Content-Disposition": "attachment; filename=\"service_logs.txt\""
                    },
                    body: content
                };
            }

            const lines = content.split('\n');
            const lastLines = lines.slice(-500).join('\n');
            return {
                statusCode: 200,
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ logs: lastLines })
            };
        }

        if (httpMethod === 'POST') {
            const isClear = event.path.endsWith('/clear');
            const isPush = event.path.endsWith('/push');

            if (isClear) {
                fs.writeFileSync(LOG_FILE, `[${new Date().toISOString()}] [INFO] Log file cleared via Netlify Function.\n`);
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }

            if (isPush) {
                const { level, message, context: logContext } = JSON.parse(body);
                const timestamp = new Date().toISOString();
                const logEntry = `[${timestamp}] [${(level || 'info').toUpperCase()}] (Client: ${logContext || 'Unknown'}) ${message}\n`;
                fs.appendFileSync(LOG_FILE, logEntry);
                return { statusCode: 200, body: JSON.stringify({ success: true }) };
            }
        }

        return { statusCode: 405, body: "Method Not Allowed" };
    } catch (e) {
        console.error("Logs Function Error:", e);
        return { statusCode: 500, body: JSON.stringify({ error: e.message }) };
    }
};
