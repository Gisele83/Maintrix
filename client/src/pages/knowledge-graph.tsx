import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Network, GitBranch, TrendingUp, Info } from "lucide-react";

// ─── Types ────────────────────────────────────────────────────────────────────
interface KgNode {
  id: number;
  nodeType: string;
  refTable: string | null;
  refId: string | null;
  label: string;
  metadata: Record<string, unknown> | null;
}
interface KgEdge {
  id: number;
  fromNodeId: number;
  toNodeId: number;
  relationType: string;
  weight: number;
  occurrenceCount: number;
  lastReinforcedAt: string | null;
}

// ─── Présentation par type de nœud (couleur + libellé FR + ordre des colonnes) ─
const NODE_TYPE_META: Record<string, { label: string; color: string }> = {
  equipment: { label: "Équipement", color: "#2563eb" },
  component: { label: "Composant", color: "#7c3aed" },
  failure_mode: { label: "Panne", color: "#dc2626" },
  symptom: { label: "Symptôme", color: "#ea580c" },
  error_code: { label: "Code erreur", color: "#b91c1c" },
  measurement_type: { label: "Mesure", color: "#0891b2" },
  test_type: { label: "Test", color: "#0e7490" },
  procedure: { label: "Procédure", color: "#16a34a" },
  technician: { label: "Technicien", color: "#4d7c0f" },
  work_order: { label: "Ordre de travail", color: "#a16207" },
  photo: { label: "Photo", color: "#78716c" },
  client: { label: "Client", color: "#0369a1" },
  plant: { label: "Usine", color: "#0f766e" },
  lesson_learned: { label: "Leçon (REX)", color: "#c026d3" },
};
const COLUMN_ORDER = [
  "equipment", "component", "failure_mode", "symptom", "error_code",
  "procedure", "technician", "measurement_type", "test_type",
  "work_order", "client", "plant", "lesson_learned", "photo",
];
const nodeColor = (t: string) => NODE_TYPE_META[t]?.color ?? "#64748b";
const nodeLabel = (t: string) => NODE_TYPE_META[t]?.label ?? t;

const COLUMN_WIDTH = 190;
const ROW_HEIGHT = 56;
const PADDING = 40;
const NODE_RADIUS = 8;

export default function KnowledgeGraphPage() {
  const [nodeTypeFilter, setNodeTypeFilter] = useState<string>("all");

  const { data: nodes } = useQuery<KgNode[]>({
    queryKey: ["/api/knowledge-graph/nodes"],
    queryFn: () => apiRequest("/api/knowledge-graph/nodes"),
  });
  const { data: edges } = useQuery<KgEdge[]>({
    queryKey: ["/api/knowledge-graph/edges"],
    queryFn: () => apiRequest("/api/knowledge-graph/edges"),
  });

  const layout = useMemo(() => {
    if (!nodes) return null;
    const visibleNodes = nodeTypeFilter === "all" ? nodes : nodes.filter(n => n.nodeType === nodeTypeFilter);
    const typesPresent = Array.from(new Set(visibleNodes.map(n => n.nodeType)));
    const columns = [
      ...COLUMN_ORDER.filter(t => typesPresent.includes(t)),
      ...typesPresent.filter(t => !COLUMN_ORDER.includes(t)),
    ];

    const positions = new Map<number, { x: number; y: number }>();
    const columnCounts: Record<string, number> = {};
    for (const node of visibleNodes) {
      const colIndex = columns.indexOf(node.nodeType);
      const row = columnCounts[node.nodeType] ?? 0;
      columnCounts[node.nodeType] = row + 1;
      positions.set(node.id, {
        x: colIndex * COLUMN_WIDTH + COLUMN_WIDTH / 2,
        y: row * ROW_HEIGHT + ROW_HEIGHT / 2 + PADDING,
      });
    }
    const maxRows = Math.max(1, ...Object.values(columnCounts));
    return {
      visibleNodes,
      columns,
      positions,
      width: Math.max(columns.length * COLUMN_WIDTH, 300),
      height: maxRows * ROW_HEIGHT + PADDING * 2,
    };
  }, [nodes, nodeTypeFilter]);

  const visibleNodeIds = new Set((layout?.visibleNodes ?? []).map(n => n.id));
  const visibleEdges = (edges ?? []).filter(e => visibleNodeIds.has(e.fromNodeId) && visibleNodeIds.has(e.toNodeId));
  const nodeById = new Map((nodes ?? []).map(n => [n.id, n]));

  const topEdges = [...(edges ?? [])].sort((a, b) => b.occurrenceCount - a.occurrenceCount).slice(0, 8);

  return (
    <TooltipProvider>
      <div className="min-h-screen bg-gray-50 p-6">
        <div className="max-w-6xl mx-auto space-y-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 flex items-center gap-2">
              <Network className="w-6 h-6 text-blue-600" />
              Knowledge Graph métier
            </h1>
            <p className="text-gray-500">
              Mémoire technique construite automatiquement à chaque intervention complétée — pas un jeu de données statique.
            </p>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{nodes?.length ?? 0}</div>
                <div className="text-sm text-gray-500">Nœuds</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">{edges?.length ?? 0}</div>
                <div className="text-sm text-gray-500">Relations</div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="text-2xl font-bold">
                  {edges && edges.length > 0 ? Math.max(...edges.map(e => e.occurrenceCount)) : 0}
                </div>
                <div className="text-sm text-gray-500">Renforcement maximal (occurrences)</div>
              </CardContent>
            </Card>
          </div>

          {(!nodes || nodes.length === 0) ? (
            <Card>
              <CardContent className="pt-6 text-center text-gray-500">
                Le graphe est vide pour l'instant. Il s'enrichira automatiquement à mesure que des interventions
                (réception → ... → REX) seront complétées dans Maintenance Execution.
              </CardContent>
            </Card>
          ) : (
            <>
              {/* Filtre + graphe */}
              <Card>
                <CardHeader className="flex flex-row items-center justify-between space-y-0">
                  <div>
                    <CardTitle className="text-base">Visualisation</CardTitle>
                    <CardDescription>Nœuds regroupés par type — les relations sont créées ou renforcées automatiquement.</CardDescription>
                  </div>
                  <Select value={nodeTypeFilter} onValueChange={setNodeTypeFilter}>
                    <SelectTrigger className="w-56"><SelectValue /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Tous les types</SelectItem>
                      {Array.from(new Set((nodes ?? []).map(n => n.nodeType))).map(t => (
                        <SelectItem key={t} value={t}>{nodeLabel(t)}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </CardHeader>
                <CardContent>
                  <div className="overflow-x-auto border border-gray-100 rounded-lg bg-white">
                    {layout && (
                      <svg width={layout.width} height={layout.height} className="min-w-full">
                        <defs>
                          <marker id="arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse">
                            <path d="M 0 0 L 10 5 L 0 10 z" fill="#94a3b8" />
                          </marker>
                        </defs>

                        {visibleEdges.map(edge => {
                          const from = layout.positions.get(edge.fromNodeId);
                          const to = layout.positions.get(edge.toNodeId);
                          if (!from || !to) return null;
                          const strokeWidth = Math.min(1 + edge.weight, 5);
                          return (
                            <line
                              key={edge.id}
                              x1={from.x + NODE_RADIUS} y1={from.y}
                              x2={to.x - NODE_RADIUS - 6} y2={to.y}
                              stroke="#94a3b8" strokeWidth={strokeWidth} opacity={0.6}
                              markerEnd="url(#arrow)"
                            />
                          );
                        })}

                        {layout.visibleNodes.map(node => {
                          const pos = layout.positions.get(node.id);
                          if (!pos) return null;
                          return (
                            <g key={node.id}>
                              <circle cx={pos.x} cy={pos.y} r={NODE_RADIUS} fill={nodeColor(node.nodeType)} />
                              <text x={pos.x + NODE_RADIUS + 6} y={pos.y + 4} fontSize={12} fill="#1f2937">
                                {node.label.length > 22 ? node.label.slice(0, 22) + "…" : node.label}
                              </text>
                            </g>
                          );
                        })}

                        {layout.columns.map((col, idx) => (
                          <text
                            key={col}
                            x={idx * COLUMN_WIDTH + COLUMN_WIDTH / 2}
                            y={20}
                            fontSize={11}
                            fontWeight={600}
                            textAnchor="middle"
                            fill={nodeColor(col)}
                          >
                            {nodeLabel(col)}
                          </text>
                        ))}
                      </svg>
                    )}
                  </div>
                </CardContent>
              </Card>

              {/* Top relations renforcées */}
              <Card>
                <CardHeader>
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="w-4 h-4 text-green-600" />
                    Relations les plus renforcées
                  </CardTitle>
                  <CardDescription>
                    Chaque répétition d'un même schéma (même panne résolue par la même procédure, par exemple)
                    renforce le poids de la relation — c'est la mémoire technique qui apprend avec l'usage.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-2">
                  {topEdges.map(edge => {
                    const from = nodeById.get(edge.fromNodeId);
                    const to = nodeById.get(edge.toNodeId);
                    return (
                      <div key={edge.id} className="flex items-center justify-between text-sm border-b border-gray-100 py-2 last:border-0">
                        <span>
                          <span className="font-medium">{from?.label ?? "?"}</span>
                          <GitBranch className="w-3 h-3 inline mx-1.5 text-gray-400" />
                          <span className="font-medium">{to?.label ?? "?"}</span>
                          <span className="text-gray-400 ml-1.5">({edge.relationType})</span>
                        </span>
                        <div className="flex items-center gap-2">
                          <Tooltip>
                            <TooltipTrigger>
                              <Info className="w-3.5 h-3.5 text-gray-400" />
                            </TooltipTrigger>
                            <TooltipContent>Poids : {edge.weight.toFixed(2)}</TooltipContent>
                          </Tooltip>
                          <Badge variant="secondary">{edge.occurrenceCount}×</Badge>
                        </div>
                      </div>
                    );
                  })}
                </CardContent>
              </Card>
            </>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}
