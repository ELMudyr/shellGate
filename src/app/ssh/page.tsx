"use client";

import { useEffect, useRef, useState } from "react";
import { Terminal } from "@xterm/xterm";
import { FitAddon } from "@xterm/addon-fit";
import { WebglAddon } from "@xterm/addon-webgl";
import "@xterm/xterm/css/xterm.css";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";
import { io, type Socket } from "socket.io-client";
import { toast } from "~/components/ui/toaster";

export default function SSHPage() {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const termRef = useRef<Terminal | null>(null);
  const fitRef = useRef<FitAddon | null>(null);
  const decoderRef = useRef<TextDecoder | null>(null);
  const outputBufferRef = useRef<string>("");
  const rafIdRef = useRef<number | null>(null);
  const inputQueueRef = useRef<string>("");
  const inputSendingRef = useRef<boolean>(false);
  const [connectedId, setConnectedId] = useState<string | null>(null);
  const socketRef = useRef<Socket | null>(null);

  const [host, setHost] = useState("");
  const [port, setPort] = useState<number | undefined>(22);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  useEffect(() => {
    const term = new Terminal({
      fontFamily:
        '"Nerd Font Mono", ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, "Liberation Mono", "Courier New", monospace',
      theme: {
        background: "#0a0a0a",
        foreground: "#ffffff",
      },
      cursorBlink: true,
      cols: 80,
      rows: 24,
      fontSize: 14,
      letterSpacing: 0,
      lineHeight: 1.25,
    });
    const fit = new FitAddon();
    term.loadAddon(fit);
    try {
      const webgl = new WebglAddon();
      term.loadAddon(webgl);
    } catch {
      // WebGL not available
    }
    termRef.current = term;
    fitRef.current = fit;
    decoderRef.current = new TextDecoder("utf-8");

    if (containerRef.current) {
      term.open(containerRef.current);
      fit.fit();
    }

    const onResize = () => {
      fitRef.current?.fit();
      const s = socketRef.current;
      if (s && connectedId && termRef.current) {
        s.emit("ssh:resize", {
          cols: termRef.current.cols,
          rows: termRef.current.rows,
        });
      }
    };
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!connectedId || !termRef.current || !fitRef.current) return;
    const s = socketRef.current;
    if (!s) return;
    // focus and fit, send initial size
    termRef.current.focus();
    fitRef.current.fit();
    s.emit("ssh:resize", {
      cols: termRef.current.cols ?? 80,
      rows: termRef.current.rows ?? 24,
    });

    const decodeBase64ToUtf8 = (b64: string) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      return decoderRef.current!.decode(bin);
    };
    const scheduleFlush = () => {
      if (rafIdRef.current != null) return;
      rafIdRef.current = window.requestAnimationFrame(() => {
        if (outputBufferRef.current) {
          termRef.current!.write(outputBufferRef.current);
          outputBufferRef.current = "";
        }
        rafIdRef.current = null;
      });
    };

    const onStdout = (b64: string) => {
      const text = decodeBase64ToUtf8(b64);
      outputBufferRef.current += text;
      scheduleFlush();
    };
    const onStderr = (b64: string) => {
      const text = decodeBase64ToUtf8(b64);
      outputBufferRef.current += text;
      scheduleFlush();
    };
    const onClose = () => {
      termRef.current?.write("\r\n[Connection closed]\r\n");
      setConnectedId(null);
    };
    s.on("ssh:data", onStdout);
    s.on("ssh:stderr", onStderr);
    s.on("ssh:close", onClose);
    s.on("ssh:error", (b64: string) => {
      const bin = Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
      const msg = decoderRef.current!.decode(bin);
      toast.error(msg);
    });

    const dispose = termRef.current.onData((d) => {
      s.emit("ssh:input", d);
    });

    return () => {
      s.off("ssh:data", onStdout);
      s.off("ssh:stderr", onStderr);
      s.off("ssh:close", onClose);
      s.off("ssh:error");
      dispose.dispose();
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [connectedId]);

  const connect = async () => {
    if (!host || !username) {
      toast.error("Please enter host and username");
      return;
    }
    try {
      await fetch("/api/ssh/socket");
    } catch {
      // ignore
    }
    // cleanup any existing socket
    if (socketRef.current) {
      socketRef.current.removeAllListeners();
      socketRef.current.disconnect();
    }
    const s = io({ transports: ["websocket"], path: "/socket.io" });
    socketRef.current = s;
    s.once("connect_error", (err) => {
      toast.error(`Socket error: ${err.message}`);
    });
    s.once("connect", () => {
      s.emit(
        "ssh:start",
        { host, port, username, password },
        (ack: { ok: true; id: string } | { ok: false; error: string }) => {
          if ((ack as any).ok !== true) {
            const msg = (ack as { ok: false; error: string }).error ?? "Failed";
            toast.error(msg);
            s.disconnect();
            return;
          }
          setConnectedId((ack as { ok: true; id: string }).id);
        },
      );
    });
  };

  const disconnect = async () => {
    if (!connectedId) return;
    socketRef.current?.emit("ssh:close");
    socketRef.current?.removeAllListeners();
    socketRef.current?.disconnect();
    setConnectedId(null);
  };

  const isConnected = !!connectedId;

  return (
    <div className="mt-8 space-y-4 p-4">
      {/* Status/Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-sm">
          <span
            className={`inline-block h-2 w-2 rounded-full ${isConnected ? "bg-green-500" : "bg-red-500"}`}
            aria-hidden
          />
          <span>
            Status:{" "}
            {isConnected
              ? `Connected${host ? ` to ${host}${port ? `:${port}` : ""}` : ""}`
              : "Disconnected"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {!isConnected ? (
            <div></div>
          ) : (
            <Button variant="outline" onClick={disconnect}>
              Disconnect
            </Button>
          )}
        </div>
      </div>

      {/* Connection form (hidden once connected) */}
      {!isConnected && (
        <>
          <Card>
            <CardHeader>
              <CardTitle>SSH Connection</CardTitle>
            </CardHeader>
            <CardContent>
              <form
                className="grid grid-cols-1 gap-3 md:grid-cols-5"
                onSubmit={(e) => {
                  e.preventDefault();
                  void connect();
                }}
              >
                <div className="space-y-2 md:col-span-2">
                  <Label htmlFor="host">Host</Label>
                  <Input
                    id="host"
                    value={host}
                    onChange={(e) => setHost(e.target.value)}
                    placeholder="192.168.0.10"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="port">Port</Label>
                  <Input
                    id="port"
                    type="number"
                    value={port ?? 22}
                    onChange={(e) => setPort(Number(e.target.value))}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    placeholder="root"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="password">Password</Label>
                  <Input
                    id="password"
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                  />
                </div>
                <div className="mt-3 flex items-center gap-2 md:col-span-5">
                  <Button type="submit">Connect</Button>
                </div>
              </form>
            </CardContent>
          </Card>

          {/* Favorites */}
          <Card>
            <CardHeader>
              <CardTitle>Favorites</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between rounded-md border border-white/10 p-3">
                <div>
                  <div className="text-sm font-medium">157.173.125.124</div>
                  <div className="text-xs text-white/60">
                    Click Use to prefill host
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    onClick={() => {
                      setHost("157.173.125.124");
                      setUsername("elmudyr");
                    }}
                  >
                    Use
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        </>
      )}

      {/* Terminal container: mounted always, hidden until connected */}
      <div
        className={`rounded-lg border border-white/10 ${isConnected ? "" : "hidden"}`}
      >
        <div ref={containerRef} className="h-[60vh] p-2" />
      </div>
    </div>
  );
}
