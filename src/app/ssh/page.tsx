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
  const [evtSrc, setEvtSrc] = useState<EventSource | null>(null);

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

    const onResize = () => fitRef.current?.fit();
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("resize", onResize);
      term.dispose();
      termRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!connectedId || !termRef.current || !fitRef.current) return;
    fitRef.current.fit();
    // Inform server of initial size
    const dims =
      termRef.current.cols && termRef.current.rows
        ? { cols: termRef.current.cols, rows: termRef.current.rows }
        : { cols: 80, rows: 24 };
    void fetch(`/api/ssh/resize`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: connectedId, ...dims }),
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
    const es = new EventSource(`/api/ssh/stream?id=${connectedId}`);
    es.onmessage = (ev: MessageEvent) => {
      const b64 = typeof ev.data === "string" ? ev.data : String(ev.data);
      const text = decodeBase64ToUtf8(b64);
      outputBufferRef.current += text;
      scheduleFlush();
    };
    es.addEventListener("stderr", (ev: MessageEvent) => {
      const b64 = typeof ev.data === "string" ? ev.data : String(ev.data);
      const text = decodeBase64ToUtf8(b64);
      outputBufferRef.current += text;
      scheduleFlush();
    });
    es.addEventListener("close", () => {
      termRef.current?.write("\r\n[Connection closed]\r\n");
      es.close();
      setEvtSrc(null);
      setConnectedId(null);
    });
    setEvtSrc(es);

    const flushInput = () => {
      if (inputSendingRef.current) return;
      const payload = inputQueueRef.current;
      if (!payload) return;
      inputSendingRef.current = true;
      inputQueueRef.current = "";
      void fetch(`/api/ssh/input`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: connectedId, data: payload }),
        keepalive: true,
      }).finally(() => {
        inputSendingRef.current = false;
        // send any buffered input immediately
        flushInput();
      });
    };
    const dispose = termRef.current.onData((d) => {
      inputQueueRef.current += d;
      flushInput();
    });

    return () => {
      es.close();
      setEvtSrc(null);
      dispose.dispose();
      if (rafIdRef.current != null) {
        window.cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
    };
  }, [connectedId]);

  const connect = async () => {
    if (!host || !username) return;
    const res = await fetch(`/api/ssh/start`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ host, port, username, password }),
    });
    if (!res.ok) {
      const text = await res.text();
      termRef.current?.write(`\r\n[Error] ${text}\r\n`);
      return;
    }
    const json = (await res.json()) as { id: string };
    setConnectedId(json.id);
  };

  const disconnect = async () => {
    if (!connectedId) return;
    await fetch(`/api/ssh/close`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id: connectedId }),
    });
    evtSrc?.close();
    setEvtSrc(null);
    setConnectedId(null);
  };

  return (
    <div className="space-y-4 p-4">
      <Card>
        <CardHeader>
          <CardTitle>SSH Connection</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-5">
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
          </div>
          <div className="mt-3 flex items-center gap-2">
            <Button onClick={connect} disabled={!!connectedId}>
              Connect
            </Button>
            <Button
              onClick={disconnect}
              variant="outline"
              disabled={!connectedId}
            >
              Disconnect
            </Button>
          </div>
        </CardContent>
      </Card>

      <div className="rounded-lg border border-white/10">
        <div ref={containerRef} className="h-[60vh] p-2" />
      </div>
    </div>
  );
}
