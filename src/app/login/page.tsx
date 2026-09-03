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
    <div className="min-h-screen flex flex-col bg-(--background)">
      <div className="bg-(--brand) text-(--brand-foreground) flex flex-col items-center justify-center gap-3 py-14 sm:py-8 rounded-b-[32px] shadow-[0_10px_30px_rgb(0_0_0_/_0.15)]">
        <div
          aria-hidden
          className="w-16 h-16 rounded-2xl bg-white/15 flex items-center justify-center"
        >
          <DishMarkIcon className="w-8 h-8" />
        </div>
        <div className="text-center">
          <p className="font-display font-semibold text-2xl">บ้านอร่อย</p>
          <p className="text-sm text-white/75">ระบบจัดการร้าน</p>
        </div>
      </div>

      <div className="flex-1 flex justify-center px-4 pb-10">
        <form action={login} className="w-full max-w-sm h-fit card p-6 space-y-4 relative -mt-8">
          <h1 className="section-title text-center">เข้าสู่ระบบพนักงาน</h1>
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
    </div>
  );
}
