import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { History, Search, Download, Filter, FileText, Table } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useLanguage } from "@/hooks/use-language";
import { t } from "@/lib/i18n";
import { useToast } from "@/hooks/use-toast";

export function MaintenanceHistory() {
  const { language } = useLanguage();
  const { toast } = useToast();
  const [filters, setFilters] = useState({
    search: "",
    equipmentType: "all",
    period: "all",
    status: "all",
  });

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["/api/history", filters],
    queryFn: async () => {
      const searchParams = new URLSearchParams();
      if (filters.search) searchParams.set('search', filters.search);
      if (filters.equipmentType && filters.equipmentType !== 'all') searchParams.set('equipmentType', filters.equipmentType);
      if (filters.period && filters.period !== 'all') searchParams.set('period', filters.period);
      if (filters.status && filters.status !== 'all') searchParams.set('status', filters.status);
      
      const response = await fetch(`/api/history?${searchParams.toString()}`);
      if (!response.ok) throw new Error('Failed to fetch history');
      return response.json();
    },
  });

  const handleFilterChange = (key: string, value: string) => {
    setFilters(prev => ({ ...prev, [key]: value }));
  };

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleString(language === "fr" ? "fr-FR" : "en-US", {
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const formatDuration = (minutes: number | undefined) => {
    if (!minutes) return "";
    const hours = Math.floor(minutes / 60);
    const mins = minutes % 60;
    return hours > 0 ? `${hours}h ${mins}m` : `${mins}m`;
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case "completed":
        return <Badge className="bg-carbon-green text-white">{t("resolved", language)}</Badge>;
      case "in_progress":
        return <Badge className="bg-carbon-orange text-white">{t("pending", language)}</Badge>;
      case "failed":
        return <Badge className="bg-carbon-red text-white">{t("failed", language)}</Badge>;
      default:
        return <Badge className="bg-carbon-gray-50 text-carbon-gray-90">{status}</Badge>;
    }
  };

  const equipmentTypes = [
    { value: "all", label: t("allTypes", language) },
    { value: "moteur", label: t("electricMotor", language) },
    { value: "pompe", label: t("hydraulicPump", language) },
    { value: "compresseur", label: t("compressor", language) },
    { value: "convoyeur", label: t("conveyor", language) },
  ];

  const periods = [
    { value: "all", label: t("allPeriods", language) },
    { value: "7d", label: t("last7Days", language) },
    { value: "30d", label: t("last30Days", language) },
    { value: "90d", label: t("last3Months", language) },
  ];

  const statuses = [
    { value: "all", label: t("allStatuses", language) },
    { value: "completed", label: t("resolved", language) },
    { value: "in_progress", label: t("pending", language) },
    { value: "failed", label: t("failed", language) },
  ];

  // Export functions
  const exportToCSV = () => {
    if (!sessions || sessions.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune donnée à exporter",
        variant: "destructive",
      });
      return;
    }

    const headers = [
      "Date",
      "Equipment Type", 
      "Equipment ID",
      "Zone",
      "Symptoms",
      "Diagnosis",
      "Solution",
      "Duration (min)",
      "Status",
      "Urgency"
    ];

    const csvContent = [
      headers.join(","),
      ...sessions.map(session => [
        formatDate(session.createdAt),
        session.equipmentType || "",
        session.equipmentId || "",
        session.zone || "",
        `"${session.symptoms?.replace(/"/g, '""') || ""}"`,
        `"${session.diagnosis?.replace(/"/g, '""') || ""}"`,
        `"${session.solution?.replace(/"/g, '""') || ""}"`,
        session.duration || "",
        session.resolved ? "completed" : "pending",
        session.urgency || ""
      ].join(","))
    ].join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `maintenance_history_${new Date().toISOString().split('T')[0]}.csv`;
    link.click();

    toast({
      title: t("dataExported", language),
      description: "CSV file downloaded successfully",
    });
  };

  const exportToExcel = () => {
    if (!sessions || sessions.length === 0) {
      toast({
        title: "Aucune donnée",
        description: "Aucune donnée à exporter",
        variant: "destructive",
      });
      return;
    }

    // Create HTML table for Excel
    const headers = [
      "Date", "Type d'équipement", "ID Équipement", "Zone", 
      "Symptômes", "Diagnostic", "Solution", "Durée (min)", 
      "Statut", "Urgence"
    ];

    const tableHTML = `
      <table border="1">
        <thead>
          <tr>${headers.map(h => `<th>${h}</th>`).join('')}</tr>
        </thead>
        <tbody>
          ${sessions.map(session => `
            <tr>
              <td>${formatDate(session.createdAt)}</td>
              <td>${session.equipmentType || ""}</td>
              <td>${session.equipmentId || ""}</td>
              <td>${session.zone || ""}</td>
              <td>${session.symptoms || ""}</td>
              <td>${session.diagnosis || ""}</td>
              <td>${session.solution || ""}</td>
              <td>${session.duration || ""}</td>
              <td>${session.resolved ? "Terminé" : "En cours"}</td>
              <td>${session.urgency || ""}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;

    const blob = new Blob([tableHTML], { type: "application/vnd.ms-excel" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `maintenance_history_${new Date().toISOString().split('T')[0]}.xls`;
    link.click();

    toast({
      title: t("dataExported", language),
      description: "Excel file downloaded successfully",
    });
  };

  return (
    <div className="space-y-6">
      {/* Filters */}
      <Card className="border border-carbon-gray-20 shadow-sm">
        <CardContent className="p-6">
          <div className="flex flex-col lg:flex-row lg:items-end space-y-4 lg:space-y-0 lg:space-x-4">
            <div className="flex-1">
              <label className="block text-sm font-medium text-carbon-gray-90 mb-2">
                {t("searchPlaceholder", language)}
              </label>
              <Input
                placeholder={t("searchPlaceholder", language)}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
                className="border-carbon-gray-20 focus:ring-carbon-blue focus:border-transparent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-carbon-gray-90 mb-2">
                {t("equipmentType", language)}
              </label>
              <Select value={filters.equipmentType} onValueChange={(value) => handleFilterChange("equipmentType", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {equipmentTypes.map((type) => (
                    <SelectItem key={type.value} value={type.value}>
                      {type.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-carbon-gray-90 mb-2">
                Période
              </label>
              <Select value={filters.period} onValueChange={(value) => handleFilterChange("period", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {periods.map((period) => (
                    <SelectItem key={period.value} value={period.value}>
                      {period.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <label className="block text-sm font-medium text-carbon-gray-90 mb-2">
                {t("status", language)}
              </label>
              <Select value={filters.status} onValueChange={(value) => handleFilterChange("status", value)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {statuses.map((status) => (
                    <SelectItem key={status.value} value={status.value}>
                      {status.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button className="bg-carbon-blue text-white hover:bg-blue-700 transition-colors duration-200 font-medium">
              <Filter className="w-4 h-4 mr-2" />
              {t("filter", language)}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* History Table */}
      <Card className="border border-carbon-gray-20 shadow-sm overflow-hidden">
        <CardHeader className="border-b border-carbon-gray-20">
          <div className="flex items-center justify-between">
            <CardTitle className="text-xl font-semibold text-carbon-gray-90 flex items-center space-x-2">
              <History className="text-carbon-blue" />
              <span>{t("maintenanceHistory", language)}</span>
            </CardTitle>
            <div className="flex space-x-2">
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToCSV}
                className="text-carbon-blue border-carbon-blue hover:bg-carbon-blue hover:text-white"
              >
                <FileText className="w-4 h-4 mr-2" />
                {t("exportCSV", language)}
              </Button>
              <Button 
                variant="outline" 
                size="sm"
                onClick={exportToExcel}
                className="text-carbon-green border-carbon-green hover:bg-carbon-green hover:text-white"
              >
                <Table className="w-4 h-4 mr-2" />
                {t("exportExcel", language)}
              </Button>
            </div>
          </div>
        </CardHeader>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-carbon-gray-10">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("date", language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("equipment", language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("symptoms", language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("diagnosisResult", language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("status", language)}
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-carbon-gray-70 uppercase tracking-wider">
                  {t("actions", language)}
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-carbon-gray-20">
              {isLoading ? (
                <tr>
                  <td colSpan={6} className="px-6 py-4 text-center">
                    <div className="animate-pulse space-y-2">
                      <div className="h-4 bg-carbon-gray-20 rounded w-3/4 mx-auto"></div>
                      <div className="h-4 bg-carbon-gray-20 rounded w-1/2 mx-auto"></div>
                    </div>
                  </td>
                </tr>
              ) : sessions.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-6 py-8 text-center text-carbon-gray-70">
                    Aucun historique trouvé
                  </td>
                </tr>
              ) : (
                sessions.map((session: any) => (
                  <tr key={session.id} className="hover:bg-carbon-gray-10 transition-colors duration-150">
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-carbon-gray-90">
                      {formatDate(session.createdAt)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="text-sm font-medium text-carbon-gray-90">{session.equipmentId}</div>
                      <div className="text-sm text-carbon-gray-70">{session.equipmentType}</div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-carbon-gray-90 max-w-xs truncate">
                        {session.symptoms}
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="text-sm text-carbon-gray-90">{session.selectedDiagnosis}</div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      {getStatusBadge(session.status)}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-carbon-blue">
                      <button className="hover:underline mr-3">{t("details", language)}</button>
                      <button className="hover:underline">{t("repeat", language)}</button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        <div className="border-t border-carbon-gray-20 bg-carbon-gray-10 px-6 py-3">
          <div className="flex items-center justify-between">
            <div className="text-sm text-carbon-gray-70">
              Affichage de 1 à {sessions.length} sur {sessions.length} interventions
            </div>
            <div className="flex items-center space-x-2">
              <Button
                variant="outline"
                size="sm"
                className="px-3 py-1 border-carbon-gray-20 text-carbon-gray-70 hover:bg-white transition-colors duration-200"
              >
                Précédent
              </Button>
              <Button size="sm" className="px-3 py-1 bg-carbon-blue text-white">
                1
              </Button>
              <Button
                variant="outline"
                size="sm"
                className="px-3 py-1 border-carbon-gray-20 text-carbon-gray-70 hover:bg-white transition-colors duration-200"
              >
                Suivant
              </Button>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
