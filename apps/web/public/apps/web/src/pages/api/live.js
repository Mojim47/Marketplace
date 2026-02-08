export default function handler(_req, res) {
  res.status(200).json({ status: 'live', timestamp: new Date().toISOString() });
}
//# sourceMappingURL=live.js.map
