import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { Plus, Search, Edit, Trash2, Eye, Factory } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

const equipmentSchema = z.object({
  equipmentName: z.string().min(1, "Nom de l'équipement requis"),
  equipmentType: z.string().min(1, "Type d'équipement requis"),
  equipmentId: z.string().min(1, "ID équipement requis"),
  location: z.string().min(1, "Localisation requise"),
  zone: z.string().min(1, "Zone requise"),
  operationalState: z.string().min(1, "Statut requis"),
  criticalityLevel: z.string().min(1, "Niveau de criticité requis"),
  manufacturer: z.string().optional(),
  model: z.string().optional(),
  serialNumber: z.string().optional(),
  installationDate: z.string().optional(),
  sector: z.string().optional(),
  technicalSpecs: z.string().optional(),
  maintenanceNotes: z.string().optional()
});

type EquipmentFormData = z.infer<typeof equipmentSchema>;

interface Equipment {
  id: number;
  equipmentName: string;
  equipmentType: string;
  equipmentId: string;
  location: string;
  zone: string;
  operationalState: string;
  criticalityLevel: string;
  manufacturer?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  sector?: string;
  technicalSpecs?: any;
  maintenanceNotes?: string;
  createdAt?: string;
}

export function EquipmentManagement() {
  const [searchTerm, setSearchTerm] = useState("");
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [selectedEquipment, setSelectedEquipment] = useState<Equipment | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // Fetch equipment list
  const { data: equipment = [], isLoading } = useQuery<Equipment[]>({
    queryKey: ["/api/equipment"],
  });

  // Add equipment mutation
  const addEquipmentMutation = useMutation({
    mutationFn: (data: EquipmentFormData) => {
      console.log("Sending equipment data:", data);
      return apiRequest("/api/equipment", {
        method: "POST",
        body: data
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsAddDialogOpen(false);
      toast({
        title: "Équipement ajouté",
        description: "Le nouvel équipement a été ajouté avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible d'ajouter l'équipement",
        variant: "destructive",
      });
    }
  });

  // Update equipment mutation
  const updateEquipmentMutation = useMutation({
    mutationFn: ({ id, data }: { id: number; data: EquipmentFormData }) => 
      apiRequest(`/api/equipment/${id}`, {
        method: "PUT",
        body: data
      }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      setIsEditDialogOpen(false);
      setSelectedEquipment(null);
      toast({
        title: "Équipement mis à jour",
        description: "L'équipement a été mis à jour avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour l'équipement",
        variant: "destructive",
      });
    }
  });

  // Delete equipment mutation
  const deleteEquipmentMutation = useMutation({
    mutationFn: (id: number) => apiRequest(`/api/equipment/${id}`, {
      method: "DELETE"
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/equipment"] });
      toast({
        title: "Équipement supprimé",
        description: "L'équipement a été supprimé avec succès",
      });
    },
    onError: () => {
      toast({
        title: "Erreur",
        description: "Impossible de supprimer l'équipement",
        variant: "destructive",
      });
    }
  });

  const form = useForm<EquipmentFormData>({
    resolver: zodResolver(equipmentSchema),
    defaultValues: {
      equipmentName: "",
      equipmentType: "",
      equipmentId: "",
      location: "",
      zone: "",
      operationalState: "operational",
      criticalityLevel: "medium",
      manufacturer: "",
      model: "",
      serialNumber: "",
      installationDate: "",
      sector: "",
      technicalSpecs: "",
      maintenanceNotes: ""
    }
  });

  const filteredEquipment = equipment.filter(eq =>
    eq.equipmentName.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.equipmentId.toLowerCase().includes(searchTerm.toLowerCase()) ||
    eq.equipmentType.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const onSubmit = (data: EquipmentFormData) => {
    if (selectedEquipment) {
      updateEquipmentMutation.mutate({ id: selectedEquipment.id, data });
    } else {
      addEquipmentMutation.mutate(data);
    }
  };

  const handleEdit = (equipment: Equipment) => {
    setSelectedEquipment(equipment);
    form.reset({
      equipmentName: equipment.equipmentName,
      equipmentType: equipment.equipmentType,
      equipmentId: equipment.equipmentId,
      location: equipment.location,
      zone: equipment.zone,
      operationalState: equipment.operationalState,
      criticalityLevel: equipment.criticalityLevel,
      manufacturer: equipment.manufacturer || "",
      model: equipment.model || "",
      serialNumber: equipment.serialNumber || "",
      installationDate: equipment.installationDate || "",
      sector: equipment.sector || "",
      technicalSpecs: equipment.technicalSpecs || "",
      maintenanceNotes: equipment.maintenanceNotes || ""
    });
    setIsEditDialogOpen(true);
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer cet équipement ?")) {
      deleteEquipmentMutation.mutate(id);
    }
  };

  const getStatusColor = (operationalState: string) => {
    switch (operationalState) {
      case "operational": return "bg-green-100 text-green-800";
      case "maintenance": return "bg-yellow-100 text-yellow-800";
      case "broken": return "bg-red-100 text-red-800";
      case "decommissioned": return "bg-gray-100 text-gray-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  const getCriticalityColor = (level: string) => {
    switch (level) {
      case "critical": return "bg-red-100 text-red-800";
      case "high": return "bg-orange-100 text-orange-800";
      case "medium": return "bg-yellow-100 text-yellow-800";
      case "low": return "bg-green-100 text-green-800";
      default: return "bg-gray-100 text-gray-800";
    }
  };

  if (isLoading) {
    return <div className="flex justify-center p-8">Chargement des équipements...</div>;
  }

  return (
    <div className="space-y-6">
      {/* Header and Actions */}
      <div className="flex justify-between items-center">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Gestion des Équipements</h2>
          <p className="text-gray-600">Gérez vos équipements industriels et leurs informations</p>
        </div>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button onClick={() => form.reset()}>
              <Plus className="w-4 h-4 mr-2" />
              Nouvel Équipement
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Ajouter un Nouvel Équipement</DialogTitle>
            </DialogHeader>
            <EquipmentForm
              form={form}
              onSubmit={onSubmit}
              isLoading={addEquipmentMutation.isPending}
              onCancel={() => setIsAddDialogOpen(false)}
            />
          </DialogContent>
        </Dialog>
      </div>

      {/* Search and Filters */}
      <div className="flex space-x-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
          <Input
            placeholder="Rechercher par nom, code ou type d'équipement..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="pl-10"
          />
        </div>
      </div>

      {/* Equipment Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {filteredEquipment.map((eq) => (
          <Card key={eq.id} className="hover:shadow-lg transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex items-center space-x-2">
                  <Factory className="w-5 h-5 text-blue-600" />
                  <CardTitle className="text-lg">{eq.equipmentName}</CardTitle>
                </div>
                <div className="flex space-x-1">
                  <Button variant="ghost" size="sm" onClick={() => handleEdit(eq)}>
                    <Edit className="w-4 h-4" />
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={() => handleDelete(eq.id)}
                    className="text-red-600 hover:text-red-700"
                  >
                    <Trash2 className="w-4 h-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="grid grid-cols-2 gap-2 text-sm">
                <div>
                  <span className="font-medium">ID:</span>
                  <p className="text-gray-600">{eq.equipmentId}</p>
                </div>
                <div>
                  <span className="font-medium">Type:</span>
                  <p className="text-gray-600">{eq.equipmentType}</p>
                </div>
                <div>
                  <span className="font-medium">Zone:</span>
                  <p className="text-gray-600">{eq.zone}</p>
                </div>
                <div>
                  <span className="font-medium">Lieu:</span>
                  <p className="text-gray-600">{eq.location}</p>
                </div>
              </div>
              
              <div className="flex justify-between items-center pt-2">
                <Badge className={getStatusColor(eq.operationalState)}>
                  {eq.operationalState}
                </Badge>
                <Badge className={getCriticalityColor(eq.criticalityLevel)}>
                  {eq.criticalityLevel}
                </Badge>
              </div>

              {eq.manufacturer && (
                <p className="text-sm text-gray-500">
                  <span className="font-medium">Fabricant:</span> {eq.manufacturer}
                </p>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      {filteredEquipment.length === 0 && (
        <div className="text-center py-12">
          <Factory className="w-12 h-12 text-gray-400 mx-auto mb-4" />
          <h3 className="text-lg font-medium text-gray-900 mb-2">Aucun équipement trouvé</h3>
          <p className="text-gray-600 mb-6">
            {searchTerm ? "Aucun équipement ne correspond à votre recherche." : "Commencez par ajouter votre premier équipement."}
          </p>
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="w-4 h-4 mr-2" />
                Ajouter un Équipement
              </Button>
            </DialogTrigger>
          </Dialog>
        </div>
      )}

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier l'Équipement</DialogTitle>
          </DialogHeader>
          <EquipmentForm
            form={form}
            onSubmit={onSubmit}
            isLoading={updateEquipmentMutation.isPending}
            onCancel={() => setIsEditDialogOpen(false)}
          />
        </DialogContent>
      </Dialog>
    </div>
  );
}

// Equipment Form Component
function EquipmentForm({ 
  form, 
  onSubmit, 
  isLoading,
  onCancel 
}: { 
  form: any; 
  onSubmit: (data: EquipmentFormData) => void; 
  isLoading: boolean;
  onCancel?: () => void; 
}) {
  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="equipmentName"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Nom de l'équipement *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Grue portique STS-01" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
          
          <FormField
            control={form.control}
            name="equipmentId"
            render={({ field }) => (
              <FormItem>
                <FormLabel>ID équipement *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: STS-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="equipmentType"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Type d'équipement *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un type" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="sts_crane">Grue STS</SelectItem>
                    <SelectItem value="rtg_crane">Grue RTG</SelectItem>
                    <SelectItem value="mobile_crane">Grue mobile</SelectItem>
                    <SelectItem value="reach_stacker">Reach stacker</SelectItem>
                    <SelectItem value="straddle_carrier">Straddle carrier</SelectItem>
                    <SelectItem value="spreader">Spreader</SelectItem>
                    <SelectItem value="conveyor">Convoyeur</SelectItem>
                    <SelectItem value="pump">Pompe</SelectItem>
                    <SelectItem value="motor">Moteur</SelectItem>
                    <SelectItem value="generator">Générateur</SelectItem>
                    <SelectItem value="transformer">Transformateur</SelectItem>
                    <SelectItem value="compressor">Compresseur</SelectItem>
                    <SelectItem value="other">Autre</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="operationalState"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Statut *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner un statut" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="operational">Opérationnel</SelectItem>
                    <SelectItem value="maintenance">En maintenance</SelectItem>
                    <SelectItem value="offline">Hors ligne</SelectItem>
                    <SelectItem value="decommissioned">Hors service</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="zone"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Zone *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner une zone" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="quay">Quai</SelectItem>
                    <SelectItem value="yard">Parc à conteneurs</SelectItem>
                    <SelectItem value="gate">Portique d'entrée</SelectItem>
                    <SelectItem value="maintenance">Atelier maintenance</SelectItem>
                    <SelectItem value="administration">Administration</SelectItem>
                    <SelectItem value="energy">Centrale énergétique</SelectItem>
                    <SelectItem value="water_treatment">Station d'épuration</SelectItem>
                    <SelectItem value="compressed_air">Air comprimé</SelectItem>
                    <SelectItem value="warehouse">Entrepôt</SelectItem>
                    <SelectItem value="laboratory">Laboratoire</SelectItem>
                    <SelectItem value="security">Sécurité</SelectItem>
                    <SelectItem value="environmental">Environnement</SelectItem>
                    <SelectItem value="it">Informatique</SelectItem>
                    <SelectItem value="logistics">Logistique</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="location"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Localisation *</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Terminal A - Poste 3" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="criticalityLevel"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Niveau de criticité *</FormLabel>
                <Select onValueChange={field.onChange} defaultValue={field.value}>
                  <FormControl>
                    <SelectTrigger>
                      <SelectValue placeholder="Sélectionner" />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    <SelectItem value="critical">Critique</SelectItem>
                    <SelectItem value="high">Élevé</SelectItem>
                    <SelectItem value="medium">Moyen</SelectItem>
                    <SelectItem value="low">Faible</SelectItem>
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="manufacturer"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Fabricant</FormLabel>
                <FormControl>
                  <Input placeholder="ex: Liebherr, Konecranes..." {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <FormField
            control={form.control}
            name="model"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Modèle</FormLabel>
                <FormControl>
                  <Input placeholder="ex: LHM 420" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="serialNumber"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Numéro de série</FormLabel>
                <FormControl>
                  <Input placeholder="ex: SN-2024-001" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        <FormField
          control={form.control}
          name="installationDate"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Date d'installation</FormLabel>
              <FormControl>
                <Input type="date" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="technicalSpecs"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Spécifications techniques</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Décrivez les spécifications techniques de l'équipement..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="maintenanceNotes"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Notes de maintenance</FormLabel>
              <FormControl>
                <Textarea 
                  placeholder="Notes importantes pour la maintenance..."
                  rows={3}
                  {...field} 
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <div className="flex justify-end space-x-2 pt-4">
          <Button type="button" variant="outline" onClick={onCancel}>
            Annuler
          </Button>
          <Button type="submit" disabled={isLoading}>
            {isLoading ? "Enregistrement..." : "Enregistrer"}
          </Button>
        </div>
      </form>
    </Form>
  );
}