import type { ReactNode } from "react";

/** A titled section of a Part. `kind` names the content type so readers always know what they are reading. */
export function Section({
  id,
  icon,
  title,
  kind,
  children,
}: {
  id: string;
  icon: ReactNode;
  title: string;
  kind: string;
  children: ReactNode;
}) {
  return (
    <section id={id} aria-labelledby={`${id}-title`} className="scroll-mt-24">
      <div className="mb-5 flex items-center gap-3">
        <span className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-2 text-ink-2">{icon}</span>
        <div>
          <h2 id={`${id}-title`} className="font-serif text-xl font-semibold text-ink">
            {title}
          </h2>
          <p className="text-xs uppercase tracking-wider text-ink-3">{kind}</p>
        </div>
      </div>
      {children}
    </section>
  );
}
