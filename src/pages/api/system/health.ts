import type { APIRoute } from 'astro';

export const GET: APIRoute = async () => {
  return new Response(
    JSON.stringify({
      ok: true,
      service: 'DeckTakeoffPro',
      timestamp: new Date().toISOString()
    }),
    {
      status: 200,
      headers: { 'content-type': 'application/json' }
    }
  );
};
