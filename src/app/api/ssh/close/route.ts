import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { close } from "~/server/ssh/manager";

export const dynamic = "force-dynamic";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const id = typeof raw.id === "string" ? raw.id : "";
    if (!id) return new Response("Invalid params", { status: 400 });
    close(id);
    return Response.json({ ok: true });
  } catch (e: unknown) {
    return new Response(String(e instanceof Error ? e.message : e), {
      status: 500,
    });
  }
}
