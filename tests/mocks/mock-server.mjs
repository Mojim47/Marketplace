/**
 * Mock API Server for Postman Collection Testing
 * Simulates NextGen Marketplace API endpoints
 * 
 * NOTE: This file is for TESTING ONLY and should NEVER be included in production builds.
 * It was moved from apps/api/mock-server.mjs to tests/mocks/ for proper separation.
 */
import http from 'http';

const PORT = 3000;

// In-memory storage
const users = new Map();
const tokens = new Map();
const products = [];
const orders = [];
const invoices = [];

// Helper functions
const generateId = () => Math.random().toString(36).substring(2, 15);
const generateToken = () => `tok_${generateId()}${generateId()}`;

const parseBody = (req) => new Promise((resolve) => {
  let body = '';
  req.on('data', chunk => body += chunk);
  req.on('end', () => {
    try { resolve(JSON.parse(body || '{}')); }
    catch { resolve({}); }
  });
});

const sendJson = (res, status, data) => {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(data));
};

// Route handlers
const routes = {
  'GET /api/v3/health': (req, res) => {
    sendJson(res, 200, { status: 'ok', timestamp: new Date().toISOString(), version: '3.0.0' });
  },

  'POST /api/v3/auth/register': async (req, res) => {
    const body = await parseBody(req);
    if (!body.email || !body.password) {
      return sendJson(res, 400, { error: 'Email and password required' });
    }
    if (users.has(body.email)) {
      return sendJson(res, 409, { error: 'User already exists' });
    }
    const user = { id: generateId(), email: body.email, name: body.name || 'User', createdAt: new Date().toISOString() };
    users.set(body.email, { ...user, password: body.password });
    sendJson(res, 201, { user, message: 'User registered successfully' });
  },

  'POST /api/v3/auth/login': async (req, res) => {
    const body = await parseBody(req);
    const user = users.get(body.email);
    if (!user || user.password !== body.password) {
      return sendJson(res, 401, { error: 'Invalid credentials' });
    }
    const accessToken = generateToken();
    const refreshToken = generateToken();
    tokens.set(accessToken, { userId: user.id, email: user.email, type: 'access' });
    tokens.set(refreshToken, { userId: user.id, email: user.email, type: 'refresh' });
    sendJson(res, 200, { access_token: accessToken, refresh_token: refreshToken, expires_in: 3600 });
  },

  'POST /api/v3/auth/refresh': async (req, res) => {
    const body = await parseBody(req);
    const tokenData = tokens.get(body.refresh_token);
    if (!tokenData || tokenData.type !== 'refresh') {
      return sendJson(res, 401, { error: 'Invalid refresh token' });
    }
    const newAccessToken = generateToken();
    tokens.set(newAccessToken, { ...tokenData, type: 'access' });
    sendJson(res, 200, { access_token: newAccessToken, expires_in: 3600 });
  },

  'POST /api/v3/auth/logout': async (req, res) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      tokens.delete(auth.slice(7));
    }
    sendJson(res, 200, { message: 'Logged out successfully' });
  },

  'GET /api/v3/products': (req, res) => {
    sendJson(res, 200, { data: products, total: products.length, page: 1, limit: 20 });
  },

  'POST /api/v3/products': async (req, res) => {
    const body = await parseBody(req);
    const product = { id: generateId(), ...body, createdAt: new Date().toISOString() };
    products.push(product);
    sendJson(res, 201, { product });
  },

  'POST /api/v3/orders': async (req, res) => {
    const body = await parseBody(req);
    const order = { id: generateId(), ...body, status: 'pending', createdAt: new Date().toISOString() };
    orders.push(order);
    sendJson(res, 201, { order });
  },

  'POST /api/v3/invoices': async (req, res) => {
    const body = await parseBody(req);
    const invoice = { id: generateId(), order_id: body.order_id, amount: 99.99, status: 'pending', createdAt: new Date().toISOString() };
    invoices.push(invoice);
    sendJson(res, 201, { invoice });
  },

  'POST /api/v3/payments': async (req, res) => {
    const body = await parseBody(req);
    const payment = { id: generateId(), invoice_id: body.invoice_id, amount: body.amount, status: 'completed', createdAt: new Date().toISOString() };
    sendJson(res, 201, { payment });
  },

  'POST /api/v3/tax/calculate': async (req, res) => {
    const body = await parseBody(req);
    const totalAmount = body.items?.reduce((sum, item) => sum + (item.amount || 0), 0) || 0;
    const taxRate = body.jurisdiction === 'IR' ? 0.09 : 0.1;
    sendJson(res, 200, { subtotal: totalAmount, tax_rate: taxRate, tax_amount: totalAmount * taxRate, total: totalAmount * (1 + taxRate) });
  },
};

// Server
const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://localhost:${PORT}`);
  const routeKey = `${req.method} ${url.pathname}`;
  
  console.log(`[${new Date().toISOString()}] ${routeKey}`);
  
  const handler = routes[routeKey];
  if (handler) {
    await handler(req, res);
  } else {
    sendJson(res, 404, { error: 'Not found', path: url.pathname });
  }
});

server.listen(PORT, () => {
  console.log(`\n🚀 Mock API Server running on http://localhost:${PORT}`);
  console.log(`📚 Endpoints: ${Object.keys(routes).length}`);
  console.log(`\nAvailable routes:`);
  Object.keys(routes).forEach(r => console.log(`  ${r}`));
});
