export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (!body) {
    return new Response(JSON.stringify({ ok: false }), {
      status: 400,
      headers: { 'content-type': 'application/json' },
    });
  }
  return new Response(null, { status: 204 });
}
