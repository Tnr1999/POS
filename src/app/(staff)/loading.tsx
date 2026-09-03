export default function StaffLoading() {
  return (
    <div className="flex items-center justify-center py-24" role="status" aria-label="กำลังโหลด">
      <span
        className="w-9 h-9 rounded-full border-[3px] border-(--surface-border) border-t-(--brand) animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}
