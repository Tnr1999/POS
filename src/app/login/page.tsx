import { login } from "./actions";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <form
        action={login}
        className="w-full max-w-sm bg-white rounded-xl shadow p-6 space-y-4"
      >
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
          className="w-full bg-black text-white rounded-lg py-2 font-medium"
        >
          เข้าสู่ระบบ
        </button>
      </form>
    </div>
  );
}
