import { LoginBrandPanel } from "./login-brand-panel";
import { LoginForm } from "./login-form";

export function LoginScreen() {
  return (
    <main className="min-h-screen bg-[oklch(0.975_0.006_160)] text-foreground">
      <div className="grid min-h-screen lg:grid-cols-[minmax(0,1.04fr)_minmax(420px,0.96fr)]">
        <LoginBrandPanel />
        <section className="flex items-center justify-center px-5 py-10 sm:px-8 lg:px-12">
          <LoginForm />
        </section>
      </div>
    </main>
  );
}
