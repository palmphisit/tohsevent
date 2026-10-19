"use client";

import { useState } from "react";

/** Switches between the registration tab's panels (all rendered on the server). */
export function Panels({ panels }: { panels: { id: string; label: string; content: React.ReactNode }[] }) {
  const [active, setActive] = useState(panels[0].id);
  return (
    <div>
      <div role="tablist" className="flex gap-1 rounded-xl bg-slate-200/60 p-1">
        {panels.map((p) => (
          <button
            key={p.id}
            role="tab"
            type="button"
            aria-selected={active === p.id}
            onClick={() => setActive(p.id)}
            className={`flex-1 rounded-lg px-3 py-2 text-sm font-medium transition ${active === p.id ? "bg-white shadow-sm" : "text-slate-500 hover:text-slate-800"}`}
          >
            {p.label}
          </button>
        ))}
      </div>
      {panels.map((p) => (
        <div key={p.id} hidden={active !== p.id} className="mt-4">
          {p.content}
        </div>
      ))}
    </div>
  );
}
