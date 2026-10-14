"use client";

import { usePathname } from "next/navigation";
import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/lib/api";
import { currentSession, redirectToLogin } from "@/lib/auth";
import { Loading } from "./states";

// Pages anyone can open: the sign-in page and the known-limitations page.
const PUBLIC = ["/login", "/limitations"];

/** Shows the page only when sign-in is off on the server, or the browser holds a valid session. */
export function AuthGate({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isPublic = PUBLIC.some((p) => pathname.startsWith(p));
  const [ok, setOk] = useState(false);

  useEffect(() => {
    if (isPublic) return;
    let alive = true;
    const decide = async (): Promise<boolean> => {
      if (currentSession()) return true;
      try {
        if (!(await api.authConfig()).enabled) return true;
      } catch {
        return true; // backend unreachable: let the page render its own connection error
      }
      redirectToLogin();
      return false;
    };
    decide().then((allowed) => alive && setOk(allowed));
    return () => {
      alive = false;
    };
  }, [isPublic, pathname]);

  if (isPublic || ok) return <>{children}</>;
  return (
    <div className="mx-auto w-full max-w-[1360px] px-4 py-8 sm:px-8">
      <Loading what="phiên đăng nhập" />
    </div>
  );
}
