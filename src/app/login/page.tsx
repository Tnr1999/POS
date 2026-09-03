import { login } from "./actions";
import { DishMarkIcon } from "@/components/icons";
import { Input } from "@/components/Input";
import { Button } from "@/components/Button";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ from?: string; error?: string }>;
}) {
  const { from, error } = await searchParams;

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6 bg-(--background) px-4">
      <div className="flex flex-col items-center gap-2">
        <div
          aria-hidden
          className="w-14 h-14 rounded-2xl bg-(--brand) text-(--brand-foreground) flex items-center justify-center shadow-[0_10px_30px_rgb(0_0_0_/_0.15)]"
        >
          <DishMarkIcon className="w-7 h-7" />
        </div>
        <p className="font-display font-semibold text-lg text-(--foreground)">บ้านอร่อย</p>
      </div>
      <form action={login} className="w-full max-w-sm card p-6 space-y-4">
        <h1 className="text-xl font-bold text-center">เข้าสู่ระบบพนักงาน</h1>
        <input type="hidden" name="from" value={from ?? "/pos"} />

        {error && (
          <p className="text-(--text-danger) text-sm text-center">
            รหัสผ่านไม่ถูกต้อง
          </p>
        )}

        <div>
          <label className="block text-sm font-medium mb-1">รหัสผ่าน</label>
          <Input type="password" name="password" autoFocus required />
        </div>

        <Button type="submit" fullWidth>
          เข้าสู่ระบบ
        </Button>
      </form>
    </div>
  );
}
