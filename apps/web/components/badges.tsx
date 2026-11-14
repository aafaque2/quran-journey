import type { ContentCategory, PartStatus } from "@quran-journey/schema";
import { CATEGORY, STATUS_LABEL } from "@/lib/format";
import { AlertIcon, BookIcon, CompassIcon, FeatherIcon, OctagramIcon, ScaleIcon } from "./icons";

const CATEGORY_ICON: Record<ContentCategory, (p: { className?: string }) => React.ReactElement> = {
  established: OctagramIcon,
  scholarly_interpretation: BookIcon,
  scholarly_disagreement: ScaleIcon,
  editorial_synthesis: CompassIcon,
  reflection: FeatherIcon,
};

export function CategoryBadge({ category }: { category: ContentCategory }) {
  const Icon = CATEGORY_ICON[category];
  return (
    <span className="badge" data-cat={category} title={CATEGORY[category].description}>
      <Icon className="h-3.5 w-3.5" />
      {CATEGORY[category].label}
    </span>
  );
}

export function StatusBadge({ status }: { status: PartStatus }) {
  if (status === "PUBLISHED") return null;
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full bg-warn-bg px-2.5 py-0.5 text-xs font-semibold text-warn">
      <AlertIcon className="h-3.5 w-3.5" />
      {STATUS_LABEL[status]}
    </span>
  );
}
