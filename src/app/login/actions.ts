"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { createSessionCookieValue, SESSION_COOKIE_NAME } from "@/lib/session";

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  const from = String(formData.get("from") ?? "/pos");

  if (!password || password !== process.env.ADMIN_PASSWORD) {
    redirect(`/login?error=1&from=${encodeURIComponent(from)}`);
  }

  const store = await cookies();
  store.set(SESSION_COOKIE_NAME, createSessionCookieValue(), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 24 * 30,
  });

  redirect(from.startsWith("/") ? from : "/pos");
}

export async function logout() {
  const store = await cookies();
  store.delete(SESSION_COOKIE_NAME);
  redirect("/login");
}
