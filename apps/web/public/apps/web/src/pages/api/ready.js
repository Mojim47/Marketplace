export default function handler(_req, res) {
  // Simple readiness: could check DB / cache etc.
  res.status(200).json({ status: 'ready', timestamp: new Date().toISOString() });
}
//# sourceMappingURL=ready.js.map
