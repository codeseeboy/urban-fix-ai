// UrbanFix AI — Backend Request Logger Middleware
// Logs every incoming request with method, path, body, and response time

const ICONS = {
    GET: '📥',
    POST: '📤',
    PUT: '✏️',
    DELETE: '🗑️',
    PATCH: '🔧',
};

function timestamp() {
    return new Date().toISOString().replace('T', ' ').substring(0, 23);
}

function colorStatus(status) {
    if (status >= 500) return `\x1b[31m${status}\x1b[0m`; // red
    if (status >= 400) return `\x1b[33m${status}\x1b[0m`; // yellow
    if (status >= 300) return `\x1b[36m${status}\x1b[0m`; // cyan
    return `\x1b[32m${status}\x1b[0m`;                    // green
}

module.exports = function requestLogger(req, res, next) {
    const start = Date.now();
    const icon = ICONS[req.method] || '🔄';

    // Log body for POST/PUT (but mask passwords)
    let bodyLog = '';
    if ((req.method === 'POST' || req.method === 'PUT') && req.body && Object.keys(req.body).length > 0) {
        const safe = { ...req.body };
        if (safe.password) safe.password = '***';
        bodyLog = ` | body: ${JSON.stringify(safe)}`;
    }

    // Log query params
    let queryLog = '';
    if (req.query && Object.keys(req.query).length > 0) {
        queryLog = ` | query: ${JSON.stringify(req.query)}`;
    }

    // Log user if authenticated
    let userLog = '';
    if (req.user) {
        userLog = ` | user: ${req.user.name} (${req.user.role})`;
    }

    // Hook into response finish to log status + duration
    res.on('finish', () => {
        const ms = Date.now() - start;
        const status = colorStatus(res.statusCode);
        console.log(`${icon} [${timestamp()}] ${req.method} ${req.path} → ${status} (${ms}ms)${bodyLog}${queryLog}${userLog}`);
    });

    next();
};
