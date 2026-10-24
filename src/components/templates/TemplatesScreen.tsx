"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { ArrowRight } from "@phosphor-icons/react";
import { AppShell } from "@/components/shell/AppShell";
import { seedWizardFromPrompt } from "@/components/home/home-data";
import { useWizardStore } from "@/components/wizard/wizard-state";
import { PillTabs } from "@/components/ui-kit/PillTabs";
import { CATEGORIES, TEMPLATES, type Template } from "./templates-data";

const TABS = CATEGORIES.map((c) => ({ id: c, label: c }));

/** Template gallery at /templates: pick one and the wizard opens with its brief and slide count filled in. */
export function TemplatesScreen() {
  const router = useRouter();
  const [category, setCategory] = useState<string>("All");

  const shown = useMemo(() => (category === "All" ? TEMPLATES : TEMPLATES.filter((t) => t.category === category)), [category]);

  const use = (t: Template) => {
    seedWizardFromPrompt(t.prompt);
    useWizardStore.getState().patchSettings({ slideCount: t.slides });
    router.push("/new");
  };

  return (
    <AppShell active="templates" sidebar="full" breadcrumbs={[{ label: "Studio", href: "/" }, { label: "Templates" }]}>
      <div className="ps-page">
        <header className="mb-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4">
          <div className="min-w-0">
            <h1 className="ps-heading">Templates</h1>
            <p className="ps-body-lg mt-2">Start from a proven structure. Pick one and the wizard opens with the brief filled in; you can change anything.</p>
          </div>
          <PillTabs variant="segmented" items={TABS} value={category} onChange={setCategory} ariaLabel="Template category" />
        </header>

        <ul className="ps-tpl-grid" aria-label="Templates">
          {shown.map((t) => (
            <li key={t.id}>
              <button type="button" className="ps-tpl" onClick={() => use(t)} aria-label={`Use the ${t.title} template`}>
                <span className="ps-tpl-art" style={{ background: `linear-gradient(135deg, ${t.tint[0]}, ${t.tint[1]})` }} aria-hidden>
                  <span className="ps-tpl-slide">
                    <span className="ps-tpl-icon">{t.icon}</span>
                    <i style={{ width: "58%" }} />
                    <i style={{ width: "82%" }} />
                    <i style={{ width: "44%" }} />
                  </span>
                  <span className="ps-tpl-count">{t.slides} slides</span>
                </span>
                <span className="ps-tpl-body">
                  <span className="ps-tpl-cat">{t.category}</span>
                  <span className="ps-tpl-title">{t.title}</span>
                  <span className="ps-tpl-desc">{t.description}</span>
                  <span className="ps-tpl-use">
                    Use template <ArrowRight size={14} weight="bold" aria-hidden />
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </AppShell>
  );
}
