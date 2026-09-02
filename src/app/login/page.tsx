import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-(--background) px-4">
      <div
        aria-hidden
        className="w-14 h-14 rounded-2xl bg-(--brand) text-(--brand-foreground) flex items-center justify-center shadow-[0_10px_30px_rgb(0_0_0_/_0.15)]"
      >
        <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <path d="M3 2v7c0 1.1.9 2 2 2h1a2 2 0 0 0 2-2V2" />
          <path d="M7 2v20" />
          <path d="M17 2c-2 2-2 5-2 8a2 2 0 0 0 2 2c0-3 0-6-2-8" />
          <path d="M17 12v10" />
        </svg>
      </div>
      <form action={login} className="w-full max-w-sm card p-6 space-y-4">
        <h1 className="text-xl font-bold text-center">เข้าสู่ระบบพนักงาน</h1>
        <input type="hidden" name="from" value={from ?? "/pos"} />

        {error && (
          <p className="text-red-600 text-sm text-center">
            รหัสผ่านไม่ถูกต้อง
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
          <input
            type="password"
            name="password"
            autoFocus
            required
            className="w-full border rounded-lg px-3 py-2"
          />
        </div>

        <button
          type="submit"
          className="w-full bg-(--brand) text-(--brand-foreground) rounded-lg py-2 font-medium"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
}
