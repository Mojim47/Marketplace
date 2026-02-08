export async function GET() {
  return new Response(JSON.stringify({ status: 'ok', timestamp: new Date().toISOString() }), {
    status: 200,
    headers: { 'content-type': 'application/json' },
  });
}
