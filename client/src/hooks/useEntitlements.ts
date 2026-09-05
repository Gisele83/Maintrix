import { useQuery } from "@tanstack/react-query";
import { useAuth } from "@/hooks/useAuth";

export interface PlatformEditionDef {
  key: string;
  displayName: string;
  description: string;
  domains: string[];
  highlighted?: boolean;
}

interface EntitlementsResponse {
  platformEdition: string;
  editionDisplayName: string;
  enabledDomains: string[];
  editions: PlatformEditionDef[];
}

/**
 * Point d'intégration unique côté client pour la licence par capacité (platformEdition).
 *
 * Fail-open par défaut : ce hook sert l'UX (badges, filtrage de confort dans la nav/dashboard),
 * ce n'est pas une frontière de sécurité — `isDomainEnabled` renvoie `true` tant que les données
 * n'ont pas encore chargé, pour ne jamais faire disparaître un élément à tort le temps du fetch.
 * Un vrai contrôle d'accès reste toujours porté côté serveur.
 */
export function useEntitlements() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading } = useQuery<EntitlementsResponse>({
    queryKey: ["/api/platform/entitlements"],
    enabled: isAuthenticated,
    staleTime: 5 * 60 * 1000,
  });

  return {
    platformEdition: data?.platformEdition,
    editionDisplayName: data?.editionDisplayName,
    enabledDomains: data?.enabledDomains ?? [],
    editions: data?.editions ?? [],
    isDomainEnabled: (domainKey: string) => (data ? data.enabledDomains.includes(domainKey) : true),
    minEditionFor: (domainKey: string) => data?.editions.find(e => e.domains.includes(domainKey)),
    isLoading,
  };
}
