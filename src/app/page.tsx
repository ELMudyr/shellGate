import Link from "next/link";
import { LatestPost } from "~/app/_components/post";
import { auth } from "~/server/auth";
import { api, HydrateClient } from "~/trpc/server";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Button } from "~/components/ui/button";

export default async function Home() {
  const hello = await api.post.hello({ text: "from tRPC" });
  const session = await auth();

  if (session?.user) {
    void api.post.getLatest.prefetch();
  }

  return (
    <HydrateClient>
      <main className="flex min-h-screen flex-col items-center text-white">
        <div className="container flex flex-col items-center justify-center gap-12 px-4 py-16">
          {/* <h1 className="text-5xl font-extrabold tracking-tight sm:text-[5rem]">
            ShellGate
          </h1> */}
          <div className="grid grid-cols-1 content-stretch gap-4 sm:grid-cols-2 md:gap-8">
            <Link href="/ssh" className="block">
              <Card className="max-w-xs hover:bg-white/5">
                <CardHeader>
                  <CardTitle>shellGate →</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/80">
                    Access your SSH servers through a web-based terminal
                    interface.
                  </p>
                </CardContent>
              </Card>
            </Link>
            <Link href="/stonxV2" target="_blank" className="block">
              <Card className="max-w-xs hover:bg-white/5">
                <CardHeader>
                  <CardTitle>StonxV2 →</CardTitle>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-white/80">
                    Access Stonx stock predicting Dashboard.
                  </p>
                </CardContent>
              </Card>
            </Link>
          </div>
        </div>
      </main>
    </HydrateClient>
  );
}
