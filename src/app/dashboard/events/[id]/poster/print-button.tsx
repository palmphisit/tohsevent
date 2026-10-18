"use client";

export function PrintButton() {
  return (
    <button
      type="button"
      onClick={() => window.print()}
      className="rounded-xl bg-primary hover:bg-primary-hover px-4 py-2 text-sm font-medium text-white"
    >
      พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
