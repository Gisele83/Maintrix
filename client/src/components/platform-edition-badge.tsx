import { Badge } from "@/components/ui/badge";
import { CheckCircle2, Lock } from "lucide-react";
import type { PlatformEditionDef } from "@/hooks/useEntitlements";

interface PlatformEditionBadgeProps {
  included: boolean;
  edition?: PlatformEditionDef;
}

/**
 * Badge informatif indiquant à partir de quelle édition un domaine est inclus.
 * Purement informatif dans cette phase — n'implique aucun masquage de contenu.
 */
export function PlatformEditionBadge({ included, edition }: PlatformEditionBadgeProps) {
  if (!edition) return null;

  return included ? (
    <Badge variant="secondary" className="gap-1 bg-emerald-50 text-emerald-700 border border-emerald-200 text-[10px]">
      <CheckCircle2 className="w-3 h-3" />
      Inclus — {edition.displayName}
    </Badge>
  ) : (
    <Badge variant="outline" className="gap-1 text-slate-500 border-slate-300 text-[10px]">
      <Lock className="w-3 h-3" />
      Nécessite {edition.displayName}
    </Badge>
  );
}
