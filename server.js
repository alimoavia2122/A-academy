// Entry point. One Express server that serves:
//   - the JSON API under /api/*
//   - the static frontend from /public
require('dotenv').config();
const express = require('express');
const path = require('path');
require('./src/config/supabase'); // stops the app early if .env is incomplete
const errorHandler = require('./src/middleware/errorHandler');

const app = express();
app.disable('x-powered-by');
app.use(express.json({ limit: '100kb' }));
app.use(express.static(path.join(__dirname, 'public')));

// To add a new module later (payroll, attendance...), create a route + controller and mount it here.
app.use('/api/auth', require('./src/routes/auth'));
app.use('/api/dashboard', require('./src/routes/dashboard'));
app.use('/api/classes', require('./src/routes/classes'));
app.use('/api/settings', require('./src/routes/settings'));
app.use('/api/students', require('./src/routes/students'));
app.use('/api/challans', require('./src/routes/challans'));
app.use('/api/payments', require('./src/routes/payments'));
app.use('/api/expenses', require('./src/routes/expenses'));
app.use('/api/reports', require('./src/routes/reports'));

app.get('/', (req, res) => res.redirect('/login.html'));
app.use('/api', (req, res) => res.status(404).json({ success: false, error: 'API route not found' }));
app.use(errorHandler);

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Arhum Academy Portal running on http://localhost:${PORT}`));
