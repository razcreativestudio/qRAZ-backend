/**
 * QRAZ Backend API Server - Local Test Version
 * Uses in-memory storage instead of MongoDB for easy testing
 * RAZ Creative Studio
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');

// Initialize Express app
const app = express();

// In-memory storage for testing
const qrStorage = new Map();
const scanLogs = [];

// Generate random short code
function generateShortCode(length = 7) {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
}

// =======================
// Middleware
// =======================

app.use(helmet({ contentSecurityPolicy: false }));

const corsOptions = {
    origin: '*', // Allow all for testing
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
    next();
});

// =======================
// Routes
// =======================

// Health check
app.get('/', (req, res) => {
    res.json({
        name: 'QRAZ Backend API (Test Mode)',
        version: '1.0.0',
        status: 'running',
        mode: 'in-memory (no MongoDB)',
        qrCount: qrStorage.size,
        scanCount: scanLogs.length
    });
});

app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Create Dynamic QR
app.post('/api/qr/dynamic', (req, res) => {
    try {
        const { targetUrl, title } = req.body;

        if (!targetUrl) {
            return res.status(400).json({ success: false, error: 'Target URL is required' });
        }

        const shortCode = generateShortCode();
        const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
        const shortUrl = `${baseUrl}/qr/${shortCode}`;

        const qrData = {
            shortCode,
            targetUrl,
            title: title || null,
            isActive: true,
            totalScans: 0,
            createdAt: new Date(),
            updatedAt: new Date()
        };

        qrStorage.set(shortCode, qrData);

        console.log(`✅ Dynamic QR created: ${shortCode} -> ${targetUrl}`);

        res.status(201).json({
            success: true,
            shortCode,
            shortUrl,
            targetUrl,
            createdAt: qrData.createdAt
        });

    } catch (error) {
        console.error('❌ Create QR error:', error);
        res.status(500).json({ success: false, error: 'Failed to create dynamic QR' });
    }
});

// Redirect endpoint
app.get('/qr/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const qr = qrStorage.get(shortCode);

    if (!qr || !qr.isActive) {
        return res.status(404).send(`
            <!DOCTYPE html>
            <html>
            <head><title>QR Not Found</title>
            <style>body{font-family:'Poppins',sans-serif;background:#121212;color:#f0f0f0;display:flex;justify-content:center;align-items:center;height:100vh;margin:0}
            .container{text-align:center}h1{color:#FFD700}a{color:#FFD700}</style></head>
            <body><div class="container"><h1>QR Code Not Found</h1><p>This QR code is invalid or has been deactivated.</p>
            <p><a href="https://raz.my.id">Visit RAZ Creative Studio</a></p></div></body></html>
        `);
    }

    // Log scan
    scanLogs.push({
        shortCode,
        timestamp: new Date(),
        ipAddress: req.ip || 'unknown',
        userAgent: req.headers['user-agent'] || 'unknown',
        deviceType: req.headers['user-agent']?.includes('Mobile') ? 'mobile' : 'desktop'
    });

    qr.totalScans++;

    console.log(`📊 Scan logged: ${shortCode}`);
    res.redirect(302, qr.targetUrl);
});

// Update QR
app.put('/api/qr/update', (req, res) => {
    const { shortCode, newTargetUrl } = req.body;

    if (!shortCode || !newTargetUrl) {
        return res.status(400).json({ success: false, error: 'Short code and new target URL are required' });
    }

    const qr = qrStorage.get(shortCode);
    if (!qr) {
        return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    qr.targetUrl = newTargetUrl;
    qr.updatedAt = new Date();

    res.json({ success: true, shortCode, targetUrl: qr.targetUrl, updatedAt: qr.updatedAt });
});

// Delete QR
app.delete('/api/qr/delete/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const qr = qrStorage.get(shortCode);

    if (!qr) {
        return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    qr.isActive = false;
    res.json({ success: true, message: 'QR code deactivated successfully' });
});

// Get QR info
app.get('/api/qr/info/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const qr = qrStorage.get(shortCode);

    if (!qr) {
        return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;

    res.json({
        success: true,
        shortCode: qr.shortCode,
        shortUrl: `${baseUrl}/qr/${qr.shortCode}`,
        targetUrl: qr.targetUrl,
        title: qr.title,
        isActive: qr.isActive,
        totalScans: qr.totalScans,
        createdAt: qr.createdAt,
        updatedAt: qr.updatedAt
    });
});

// Get Analytics
app.get('/api/qr/analytics/:shortCode', (req, res) => {
    const { shortCode } = req.params;
    const qr = qrStorage.get(shortCode);

    if (!qr) {
        return res.status(404).json({ success: false, error: 'QR code not found' });
    }

    const qrScans = scanLogs.filter(s => s.shortCode === shortCode);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const todayScans = qrScans.filter(s => new Date(s.timestamp) >= today).length;
    const uniqueIPs = new Set(qrScans.map(s => s.ipAddress)).size;

    // Group by date (last 7 days)
    const scansPerDay = [];
    for (let i = 6; i >= 0; i--) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateStr = date.toISOString().slice(0, 10);
        const count = qrScans.filter(s => s.timestamp.toISOString().slice(0, 10) === dateStr).length;
        scansPerDay.push({ date: dateStr, count });
    }

    // Device breakdown
    const deviceCounts = {};
    qrScans.forEach(s => {
        deviceCounts[s.deviceType] = (deviceCounts[s.deviceType] || 0) + 1;
    });
    const deviceBreakdown = Object.entries(deviceCounts).map(([device, count]) => ({ device, count }));

    res.json({
        success: true,
        shortCode,
        targetUrl: qr.targetUrl,
        isActive: qr.isActive,
        totalScans: qr.totalScans,
        uniqueScans: uniqueIPs,
        todayScans,
        scansPerDay,
        deviceBreakdown,
        createdAt: qr.createdAt
    });
});

// List all QRs
app.get('/api/qr/list', (req, res) => {
    const baseUrl = process.env.BASE_URL || `http://localhost:${process.env.PORT || 3000}`;
    const qrs = Array.from(qrStorage.values())
        .filter(qr => qr.isActive)
        .map(qr => ({
            ...qr,
            shortUrl: `${baseUrl}/qr/${qr.shortCode}`
        }));

    res.json({ success: true, qrs, total: qrs.length });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({ success: false, error: 'Endpoint not found', path: req.url });
});

// =======================
// Start Server
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║     QRAZ Backend API Server (TEST)        ║
║        RAZ Creative Studio © 2024         ║
╠═══════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}            ║
║  📊 Mode: In-Memory (No MongoDB)          ║
║  ⚠️  Data will be lost on restart         ║
╚═══════════════════════════════════════════╝
    `);
});

module.exports = app;
