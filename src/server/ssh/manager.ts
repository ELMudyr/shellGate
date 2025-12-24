/* eslint-disable @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-unsafe-assignment */
import { Client } from "ssh2";
import type { ClientChannel } from "ssh2";
import { randomUUID } from "crypto";

export type SSHConnectionParams = {
  host: string;
  port?: number;
  username: string;
  password?: string;
};

export type Subscriber = {
  enqueue: (chunk: string) => void;
  close: () => void;
};

type ManagedConn = {
  id: string;
  client: Client;
  stream?: ClientChannel;
  subscribers: Set<Subscriber>;
  ready: boolean;
};

const connections = new Map<string, ManagedConn>();

export function createConnection(params: SSHConnectionParams): {
  id: string;
  promise: Promise<string>;
} {
  const id = randomUUID();
  const client = new Client();
  const managed: ManagedConn = {
    id,
    client,
    subscribers: new Set(),
    ready: false,
  };
  connections.set(id, managed);

  const promise = new Promise<string>((resolve, reject) => {
    client
      .on("ready", () => {
        client.shell(
          { term: "xterm-256color" },
          (err: Error | undefined, stream: ClientChannel) => {
            if (err) {
              reject(new Error(err.message));
              return;
            }
            managed.stream = stream;
            managed.ready = true;

            stream.on("data", (data: Buffer | string) => {
              const buf =
                typeof data === "string" ? Buffer.from(data, "utf8") : data;
              const b64 = buf.toString("base64");
              for (const sub of managed.subscribers)
                sub.enqueue(`data: ${b64}\n\n`);
            });
            stream.stderr.on("data", (data: Buffer | string) => {
              const buf =
                typeof data === "string" ? Buffer.from(data, "utf8") : data;
              const b64 = buf.toString("base64");
              for (const sub of managed.subscribers)
                sub.enqueue(`event: stderr\ndata: ${b64}\n\n`);
            });
            stream.on("close", () => {
              for (const sub of managed.subscribers)
                sub.enqueue(`event: close\ndata: closed\n\n`);
              cleanup(id);
            });
            resolve(id);
          },
        );
      })
      .on("error", (err: Error) => {
        const b64 = Buffer.from(String(err.message), "utf8").toString(
          "base64",
        );
        for (const sub of managed.subscribers)
          sub.enqueue(`event: error\ndata: ${b64}\n\n`);
        reject(new Error(err.message));
        cleanup(id);
      })
      .connect({
        host: params.host,
        port: params.port ?? 22,
        username: params.username,
        password: params.password,
      });
  });

  return { id, promise };
}

export function subscribe(id: string, sub: Subscriber) {
  const m = connections.get(id);
  if (!m) throw new Error("Connection not found");
  m.subscribers.add(sub);
}

export function unsubscribe(id: string, sub: Subscriber) {
  const m = connections.get(id);
  if (!m) return;
  m.subscribers.delete(sub);
}

export function write(id: string, data: string) {
  const m = connections.get(id);
  if (!m?.stream) throw new Error("Stream not ready");
  m.stream.write(data);
}

export function resize(id: string, cols: number, rows: number) {
  const m = connections.get(id);
  if (!m?.stream) throw new Error("Stream not ready");
  m.stream.setWindow(rows, cols, rows, cols);
}

export function close(id: string) {
  const m = connections.get(id);
  if (!m) return;
  try {
    m.stream?.close();
  } finally {
    m.client.end();
    cleanup(id);
  }
}

function cleanup(id: string) {
  const m = connections.get(id);
  if (!m) return;
  for (const sub of m.subscribers) {
    try {
      sub.close();
    } catch {}
  }
  connections.delete(id);
}

// Using base64 encoding for SSE payload; no additional escaping needed
