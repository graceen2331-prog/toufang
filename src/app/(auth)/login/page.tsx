import type { Metadata } from "next";
import { Suspense } from "react";
import { LoginScreen } from "@/features/auth/components/login-screen";

export const metadata: Metadata = {
  title: "登录",
  description: "登录 KOL Marketing OS 工作区",
};

export default function LoginPage() {
  return (
    <Suspense>
      <LoginScreen />
    </Suspense>
  );
}
