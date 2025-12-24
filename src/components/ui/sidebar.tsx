import Link from "next/link";
import { cn } from "~/lib/cn";
import { Button } from "~/components/ui/button";
import { Home, Terminal, LogIn } from "lucide-react";

type SidebarProps = {
  className?: string;
  isAuthenticated?: boolean;
  onSignOut?: (formData: FormData) => Promise<void>;
};

export function Sidebar({
  className,
  isAuthenticated,
  onSignOut,
}: SidebarProps) {
  return (
    <nav className={cn("flex h-full flex-col gap-1 p-2 text-sm", className)}>
      <Link href="/" className="block">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Home className="h-4 w-4" />
          Home
        </Button>
      </Link>
      <Link href="/ssh" className="block">
        <Button variant="ghost" className="w-full justify-start gap-2">
          <Terminal className="h-4 w-4" />
          SSH
        </Button>
      </Link>
      {isAuthenticated ? (
        <form action={onSignOut} className="block">
          <Button variant="outline" className="w-full justify-start gap-2">
            <LogIn className="h-4 w-4" />
            Sign Out
          </Button>
        </form>
      ) : (
        <Link href="/sign-in" className="block">
          <Button variant="ghost" className="w-full justify-start gap-2">
            <LogIn className="h-4 w-4" />
            Sign In
          </Button>
        </Link>
      )}
    </nav>
  );
}
