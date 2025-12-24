import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { write } from "~/server/ssh/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    const data = typeof raw.data === "string" ? raw.data : undefined;
    if (!id || typeof data !== "string")
      return new Response("Invalid params", { status: 400 });
    write(id, data);
    return Response.json({ ok: true });
  } catch (e: unknown) {
    return new Response(String(e instanceof Error ? e.message : e), {
      status: 500,
    });
  }
}
