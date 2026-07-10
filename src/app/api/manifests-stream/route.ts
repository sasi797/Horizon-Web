import { NextRequest } from 'next/server';

export const dynamic = 'force-dynamic';

const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:8000';
const POLL_INTERVAL_MS = 8000;
const HEARTBEAT_INTERVAL_MS = 25000;

type ManifestSummary = {
  id: string;
  status: string;
  job_count: number;
  total_weight_kg: number;
};

// Relays manifest-list changes to the browser over SSE. The Next.js server polls the
// real backend (EventSource can't send auth headers, so polling here — with the
// user's token — is simpler than standing up a push channel on that backend too).
export async function GET(request: NextRequest) {
  const token = request.nextUrl.searchParams.get('token');
  if (!token) {
    return new Response('Missing token', { status: 401 });
  }

  const encoder = new TextEncoder();
  let closed = false;
  let lastSignature: string | null = null;

  const stream = new ReadableStream({
    start(controller) {
      const send = (event: string, data: unknown) => {
        if (closed) return;
        controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
      };

      const poll = async () => {
        if (closed) return;
        try {
          const res = await fetch(`${API_BASE}/hawb/manifests`, {
            headers: { Authorization: `Bearer ${token}` },
            cache: 'no-store',
          });
          if (res.status === 401 || res.status === 403) {
            send('auth-error', {});
            return;
          }
          if (!res.ok) return;

          const data: ManifestSummary[] = await res.json();
          const signature = JSON.stringify(
            data.map(m => [m.id, m.status, m.job_count, m.total_weight_kg]),
          );

          if (lastSignature === null) {
            // Baseline snapshot — the page's own initial fetch already has this data.
            lastSignature = signature;
            return;
          }
          if (signature !== lastSignature) {
            lastSignature = signature;
            send('manifests-updated', { count: data.length });
          }
        } catch {
          // Network hiccup against the backend — just retry on the next tick.
        }
      };

      poll();
      const pollTimer = setInterval(poll, POLL_INTERVAL_MS);
      const heartbeatTimer = setInterval(() => send('ping', {}), HEARTBEAT_INTERVAL_MS);

      request.signal.addEventListener('abort', () => {
        closed = true;
        clearInterval(pollTimer);
        clearInterval(heartbeatTimer);
        try { controller.close(); } catch { /* already closed */ }
      });
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
    },
  });
}
