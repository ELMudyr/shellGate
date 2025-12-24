import type { NextRequest } from "next/server";
import { auth } from "~/server/auth";
import { createConnection } from "~/server/ssh/manager";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });

  try {
    const raw = (await req.json()) as Record<string, unknown>;
    const host = typeof raw.host === "string" ? raw.host : "";
    const port = typeof raw.port === "number" ? raw.port : undefined;
    const username = typeof raw.username === "string" ? raw.username : "";
    const password =
      typeof raw.password === "string" ? raw.password : undefined;
    if (!host || !username)
      return new Response("Invalid params", { status: 400 });

    const { id, promise } = createConnection({
      host,
      port,
      username,
      password,
    });
    await promise;
    return Response.json({ id });
  } catch (e: unknown) {
    return new Response(String(e instanceof Error ? e.message : e), {
      status: 500,
    });
  }
}
