import { redirect } from "next/navigation";
import { LoginForm } from "@/components/login-form";
import { getServerSession } from "@/lib/auth";

export default async function LoginPage() {
  const session = await getServerSession();
  if (session) {
    redirect("/dashboard");
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-6">
      <LoginForm />
    </main>
  );
}
