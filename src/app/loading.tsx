export default function RootLoading() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-(--background)" role="status" aria-label="กำลังโหลด">
      <span
        className="w-9 h-9 rounded-full border-[3px] border-(--surface-border) border-t-(--brand) animate-spin"
        aria-hidden="true"
      />
    </div>
  );
}
