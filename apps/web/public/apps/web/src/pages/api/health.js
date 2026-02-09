export default function handler(_req, res) {
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.status(200).json({ status: 'ok', timestamp: new Date().toISOString() });
}
//# sourceMappingURL=health.js.map
