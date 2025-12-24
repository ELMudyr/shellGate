import { redirect } from "next/navigation";
import { auth, signIn } from "~/server/auth";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Label } from "~/components/ui/label";
import { Input } from "~/components/ui/input";
import { Button } from "~/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SignInPage() {
  const session = await auth();
  if (session?.user) redirect("/");

  async function doSignIn(formData: FormData) {
    "use server";
    const un = formData.get("username");
    const pw = formData.get("password");
    const username = typeof un === "string" ? un : "";
    const password = typeof pw === "string" ? pw : "";

    await signIn("credentials", {
      username,
      password,
      redirectTo: "/",
    });
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <Card className="w-full max-w-sm bg-black/20 backdrop-blur-md">
        <CardContent>
          <form action={doSignIn} className="space-y-4">
            <div className="space-y-2">
              <Input
                id="username"
                name="username"
                placeholder="Username"
                required
              />
            </div>
            <div className="space-y-2">
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Password"
                required
              />
            </div>
            <Button type="submit" className="w-full">
              Sign In
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
