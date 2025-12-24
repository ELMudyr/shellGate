import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { subscribe, unsubscribe } from "~/server/ssh/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  if (!id) return new Response("Missing id", { status: 400 });

  let subRef: { enqueue: (chunk: string) => void; close: () => void } | null =
    null;
  const stream = new ReadableStream<Uint8Array>({
    start(controller) {
      const sub = {
        enqueue: (chunk: string) =>
          controller.enqueue(new TextEncoder().encode(chunk)),
        close: () => controller.close(),
      };
      subRef = sub;
      try {
        subscribe(id, sub);
        // Send initial comment to keep connection alive
        controller.enqueue(new TextEncoder().encode(`: connected\n\n`));
      } catch (e) {
        controller.enqueue(
          new TextEncoder().encode(`event: error\ndata: ${String(e)}\n\n`),
        );
        controller.close();
      }
    },
    cancel() {
      if (subRef) unsubscribe(id, subRef);
      subRef = null;
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
