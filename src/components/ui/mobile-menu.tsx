"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "~/components/ui/button";
import { Home, Menu, Terminal, LogIn, LogOut } from "lucide-react";

type MobileMenuProps = {
  isAuthenticated: boolean;
  onSignOut?: (formData: FormData) => Promise<void>;
};

export function MobileMenu({ isAuthenticated, onSignOut }: MobileMenuProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <Button
        variant="ghost"
        aria-label="Open menu"
        className="fixed top-2 left-2 z-50"
        onClick={() => setOpen(true)}
      >
        <Menu className="h-5 w-5" />
      </Button>

      {open ? (
        <div className="fixed inset-0 z-50">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setOpen(false)}
          />
          <div className="absolute top-0 left-0 h-full w-64 border-r border-white/10 bg-neutral-900 p-3">
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-semibold">Menu</span>
              <Button variant="ghost" onClick={() => setOpen(false)}>
                Close
              </Button>
            </div>

            <nav className="flex flex-col gap-1">
              <Link href="/" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Home className="h-4 w-4" /> Home
                </Button>
              </Link>
              <Link href="/ssh" onClick={() => setOpen(false)}>
                <Button variant="ghost" className="w-full justify-start gap-2">
                  <Terminal className="h-4 w-4" /> SSH
                </Button>
              </Link>
              {isAuthenticated ? (
                <form action={onSignOut} className="mt-2">
                  <Button
                    type="submit"
                    variant="outline"
                    className="w-full justify-start gap-2"
                    onClick={() => setOpen(false)}
                  >
                    <LogOut className="h-4 w-4" /> Sign Out
                  </Button>
                </form>
              ) : (
                <Link href="/sign-in" onClick={() => setOpen(false)}>
                  <Button
                    variant="ghost"
                    className="w-full justify-start gap-2"
                  >
                    <LogIn className="h-4 w-4" /> Sign In
                  </Button>
                </Link>
              )}
            </nav>
          </div>
        </div>
      ) : null}
    </>
  );
}
