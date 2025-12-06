/**
 * QRAZ Backend API Server
 * Dynamic QR Code management with Analytics
 * RAZ Creative Studio
 */

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const connectDB = require('./config/db');

// Initialize Express app
const app = express();

// Connect to MongoDB
connectDB();

// =======================
// Middleware
// =======================

// Security headers
app.use(helmet({
    contentSecurityPolicy: false // Disable for redirect pages
}));

// CORS configuration
const corsOptions = {
    origin: [
        process.env.FRONTEND_URL,
        'http://localhost',
        'http://localhost:80',
        'http://127.0.0.1',
        'https://raz.my.id'
    ],
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
    credentials: true
};
app.use(cors(corsOptions));

// Parse JSON bodies
app.use(express.json());

// Parse URL-encoded bodies
app.use(express.urlencoded({ extended: true }));

// Request logging (simple)
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} | ${req.method} ${req.url}`);
    next();
});

// =======================
// Routes
// =======================

// Import routes
const qrRoutes = require('./routes/qr');

// Health check endpoint
app.get('/', (req, res) => {
    res.json({
        name: 'QRAZ Backend API',
        version: '1.0.0',
        status: 'running',
        author: 'RAZ Creative Studio',
        endpoints: {
            'POST /api/qr/dynamic': 'Create dynamic QR',
            'GET /qr/:shortCode': 'Redirect endpoint',
            'PUT /api/qr/update': 'Update target URL',
            'DELETE /api/qr/delete/:shortCode': 'Deactivate QR',
            'GET /api/qr/info/:shortCode': 'Get QR info',
            'GET /api/qr/analytics/:shortCode': 'Get analytics',
            'GET /api/qr/list': 'List all QRs'
        }
    });
});

// Health check
app.get('/health', (req, res) => {
    res.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount QR routes
// /qr/:shortCode for redirects
app.use('/qr', qrRoutes);
// /api/qr/* for API endpoints
app.use('/api/qr', qrRoutes);

// =======================
// Error Handling
// =======================

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        error: 'Endpoint not found',
        path: req.url
    });
});

// Global error handler
app.use((err, req, res, next) => {
    console.error('❌ Server Error:', err);
    res.status(500).json({
        success: false,
        error: process.env.NODE_ENV === 'development'
            ? err.message
            : 'Internal server error'
    });
});

// =======================
// Start Server
// =======================

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`
╔═══════════════════════════════════════════╗
║         QRAZ Backend API Server           ║
║        RAZ Creative Studio © 2024         ║
╠═══════════════════════════════════════════╣
║  🚀 Server running on port ${PORT}            ║
║  📊 Environment: ${process.env.NODE_ENV || 'development'}        ║
╚═══════════════════════════════════════════╝
    `);
});

// Handle unhandled promise rejections
process.on('unhandledRejection', (err) => {
    console.error('❌ Unhandled Rejection:', err);
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
    console.error('❌ Uncaught Exception:', err);
    process.exit(1);
});

module.exports = app;
