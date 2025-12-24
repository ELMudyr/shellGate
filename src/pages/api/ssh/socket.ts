import type { NextApiRequest, NextApiResponse } from "next";
import { Server as IOServer, type Socket } from "socket.io";
import type { Server as HTTPServer } from "http";
import {
  createConnection,
  subscribe,
  unsubscribe,
  write,
  resize,
  close,
  type Subscriber,
  type SSHConnectionParams,
} from "~/server/ssh/manager";

type WithIO = HTTPServer & { io?: IOServer };

function parseSSE(chunk: string): { type: string; data: string } {
  let type = "stdout";
  let data = "";
  const lines = chunk.split("\n");
  for (const line of lines) {
    if (line.startsWith("event: ")) type = line.slice(7).trim();
    else if (line.startsWith("data: ")) data = line.slice(6).trim();
  }
  return { type, data };
}

const handler = (req: NextApiRequest, res: NextApiResponse) => {
  const srv = res.socket.server as unknown as WithIO;
  if (!srv.io) {
    const io = new IOServer(srv, {
      path: "/socket.io",
      addTrailingSlash: false,
    });
    srv.io = io;

    io.on("connection", (socket: Socket) => {
      let sshId: string | null = null;
      let sub: Subscriber | null = null;

      socket.on(
        "ssh:start",
        async (
          params: SSHConnectionParams,
          ack?: (res: { ok: true; id: string } | { ok: false; error: string }) => void,
        ) => {
          try {
            const { id, promise } = createConnection(params);
            sshId = id;
            sub = {
              enqueue: (chunk: string) => {
                const { type, data } = parseSSE(chunk);
                if (type === "stderr") socket.emit("ssh:stderr", data);
                else if (type === "error") socket.emit("ssh:error", data);
                else if (type === "close") socket.emit("ssh:close");
                else socket.emit("ssh:data", data);
              },
              close: () => {
                socket.emit("ssh:close");
              },
            };
            subscribe(id, sub);
            await promise;
            ack?.({ ok: true, id });
          } catch (e) {
            const msg = e instanceof Error ? e.message : String(e);
            ack?.({ ok: false, error: msg });
          }
        },
      );

      socket.on("ssh:input", (data: string) => {
        if (!sshId) return;
        try {
          write(sshId, data);
        } catch {}
      });

      socket.on("ssh:resize", ({ cols, rows }: { cols: number; rows: number }) => {
        if (!sshId) return;
        try {
          resize(sshId, cols, rows);
        } catch {}
      });

      socket.on("ssh:close", () => {
        if (!sshId) return;
        try {
          close(sshId);
        } finally {
          if (sub) {
            try {
              unsubscribe(sshId, sub);
            } catch {}
            sub = null;
          }
          sshId = null;
        }
      });

      socket.on("disconnect", () => {
        if (sshId) {
          try {
            close(sshId);
          } catch {}
        }
        if (sshId && sub) {
          try {
            unsubscribe(sshId, sub);
          } catch {}
        }
        sshId = null;
        sub = null;
      });
    });
  }
  res.end();
};

export const config = {
  api: {
    bodyParser: false,
  },
};

export default handler;
