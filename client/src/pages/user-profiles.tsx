import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { apiRequest } from "@/lib/queryClient";
import { insertUserProfileSchema, type UserProfile, type InsertUserProfile } from "@shared/schema";
import { useToast } from "@/hooks/use-toast";
import { Plus, Edit, Trash2, User, Phone, Mail, Building, Award } from "lucide-react";

export default function UserProfiles() {
  const [createDialogOpen, setCreateDialogOpen] = useState(false);
  const [editingProfile, setEditingProfile] = useState<UserProfile | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: profiles = [], isLoading } = useQuery<UserProfile[]>({
    queryKey: ["/api/user-profiles"],
  });

  const createProfileMutation = useMutation({
    mutationFn: async (data: InsertUserProfile) => {
      return await apiRequest("/api/user-profiles", {
        method: "POST",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-profiles"] });
      setCreateDialogOpen(false);
      toast({
        title: "Profil créé",
        description: "Le profil utilisateur a été créé avec succès.",
      });
    },
    onError: (error) => {
      console.error("Create profile error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de créer le profil utilisateur.",
        variant: "destructive",
      });
    },
  });

  const updateProfileMutation = useMutation({
    mutationFn: async ({ id, data }: { id: number; data: Partial<UserProfile> }) => {
      return await apiRequest(`/api/user-profiles/${id}`, {
        method: "PUT",
        body: data,
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-profiles"] });
      setEditingProfile(null);
      toast({
        title: "Profil mis à jour",
        description: "Le profil utilisateur a été mis à jour avec succès.",
      });
    },
    onError: (error) => {
      console.error("Update profile error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de mettre à jour le profil utilisateur.",
        variant: "destructive",
      });
    },
  });

  const deleteProfileMutation = useMutation({
    mutationFn: async (id: number) => {
      return await apiRequest(`/api/user-profiles/${id}`, {
        method: "DELETE",
      });
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/user-profiles"] });
      toast({
        title: "Profil supprimé",
        description: "Le profil utilisateur a été supprimé avec succès.",
      });
    },
    onError: (error) => {
      console.error("Delete profile error:", error);
      toast({
        title: "Erreur",
        description: "Impossible de supprimer le profil utilisateur.",
        variant: "destructive",
      });
    },
  });

  const createForm = useForm<InsertUserProfile>({
    resolver: zodResolver(insertUserProfileSchema),
    defaultValues: {
      username: "",
      firstName: "",
      lastName: "",
      email: "",
      role: "technician",
      department: "",
      phoneNumber: "",
      preferredLanguage: "fr",
      specializations: [],
      experienceLevel: "intermediate",
      isActive: true,
    },
  });

  const editForm = useForm<Partial<UserProfile>>({
    resolver: zodResolver(insertUserProfileSchema.partial()),
  });

  const onCreateSubmit = (data: InsertUserProfile) => {
    createProfileMutation.mutate(data);
  };

  const onEditSubmit = (data: Partial<UserProfile>) => {
    if (editingProfile) {
      updateProfileMutation.mutate({ id: editingProfile.id, data });
    }
  };

  const handleEdit = (profile: UserProfile) => {
    setEditingProfile(profile);
    editForm.reset({
      username: profile.username,
      firstName: profile.firstName || "",
      lastName: profile.lastName || "",
      email: profile.email || "",
      role: profile.role,
      department: profile.department || "",
      phoneNumber: profile.phoneNumber || "",
      preferredLanguage: profile.preferredLanguage,
      specializations: profile.specializations || [],
      experienceLevel: profile.experienceLevel,
      isActive: profile.isActive,
    });
  };

  const handleDelete = (id: number) => {
    if (confirm("Êtes-vous sûr de vouloir supprimer ce profil utilisateur ?")) {
      deleteProfileMutation.mutate(id);
    }
  };

  const getRoleBadgeColor = (role: string | null) => {
    switch (role) {
      case "admin":
        return "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200";
      case "supervisor":
        return "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200";
      case "technician":
        return "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  const getExperienceBadgeColor = (level: string | null) => {
    switch (level) {
      case "expert":
        return "bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-200";
      case "intermediate":
        return "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200";
      case "beginner":
        return "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200";
      default:
        return "bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-200";
    }
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto py-6 space-y-6">
      <div className="flex justify-between items-center">
        <div>
          <h1 className="text-3xl font-bold">Gestion des Profils Utilisateur</h1>
          <p className="text-gray-600 dark:text-gray-400">
            Gérez les profils et les permissions des utilisateurs du système Maintrix
          </p>
        </div>
        
        <Dialog open={createDialogOpen} onOpenChange={setCreateDialogOpen}>
          <DialogTrigger asChild>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nouveau Profil
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle>Créer un Nouveau Profil Utilisateur</DialogTitle>
              <DialogDescription>
                Remplissez les informations pour créer un nouveau profil utilisateur.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...createForm}>
              <form onSubmit={createForm.handleSubmit(onCreateSubmit)} className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="username"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom d'utilisateur *</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: jean.dupont" {...field} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email</FormLabel>
                        <FormControl>
                          <Input type="email" placeholder="jean.dupont@entreprise.fr" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="technician">Technicien</SelectItem>
                            <SelectItem value="supervisor">Superviseur</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="experienceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau d'expérience</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Niveau d'expérience" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">Débutant</SelectItem>
                            <SelectItem value="intermediate">Intermédiaire</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={createForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Département</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Maintenance" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={createForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="+33 1 23 45 67 89" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={createForm.control}
                  name="preferredLanguage"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Langue préférée</FormLabel>
                      <Select onValueChange={field.onChange} defaultValue={field.value ?? undefined}>
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Sélectionner une langue" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="fr">Français</SelectItem>
                          <SelectItem value="en">English</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={createForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Compte actif</FormLabel>
                        <FormDescription>
                          Permet à l'utilisateur de se connecter au système
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setCreateDialogOpen(false)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={createProfileMutation.isPending}
                  >
                    {createProfileMutation.isPending ? "Création..." : "Créer le Profil"}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      <div className="grid gap-6">
        {profiles.map((profile: UserProfile) => (
          <Card key={profile.id} className="hover:shadow-md transition-shadow">
            <CardHeader>
              <div className="flex justify-between items-start">
                <div className="flex items-center space-x-3">
                  <div className="h-12 w-12 rounded-full bg-blue-100 dark:bg-blue-900 flex items-center justify-center">
                    <User className="h-6 w-6 text-blue-600 dark:text-blue-400" />
                  </div>
                  <div>
                    <CardTitle className="text-lg">
                      {profile.firstName && profile.lastName 
                        ? `${profile.firstName} ${profile.lastName}`
                        : profile.username
                      }
                    </CardTitle>
                    <CardDescription>@{profile.username}</CardDescription>
                  </div>
                </div>
                
                <div className="flex space-x-2">
                  <Badge className={getRoleBadgeColor(profile.role)}>
                    {profile.role === "admin" ? "Administrateur" : 
                     profile.role === "supervisor" ? "Superviseur" : "Technicien"}
                  </Badge>
                  <Badge className={getExperienceBadgeColor(profile.experienceLevel)}>
                    {profile.experienceLevel === "expert" ? "Expert" :
                     profile.experienceLevel === "intermediate" ? "Intermédiaire" : "Débutant"}
                  </Badge>
                  {!profile.isActive && (
                    <Badge variant="destructive">Inactif</Badge>
                  )}
                </div>
              </div>
            </CardHeader>
            
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-4">
                {profile.email && (
                  <div className="flex items-center space-x-2">
                    <Mail className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile.email}</span>
                  </div>
                )}
                
                {profile.phoneNumber && (
                  <div className="flex items-center space-x-2">
                    <Phone className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile.phoneNumber}</span>
                  </div>
                )}
                
                {profile.department && (
                  <div className="flex items-center space-x-2">
                    <Building className="h-4 w-4 text-gray-500" />
                    <span className="text-sm">{profile.department}</span>
                  </div>
                )}
                
                <div className="flex items-center space-x-2">
                  <Award className="h-4 w-4 text-gray-500" />
                  <span className="text-sm">
                    {profile.specializations?.length || 0} spécialisation(s)
                  </span>
                </div>
              </div>

              {profile.specializations && profile.specializations.length > 0 && (
                <div className="mb-4">
                  <p className="text-sm font-medium mb-2">Spécialisations :</p>
                  <div className="flex flex-wrap gap-1">
                    {profile.specializations.map((spec, index) => (
                      <Badge key={index} variant="secondary" className="text-xs">
                        {spec}
                      </Badge>
                    ))}
                  </div>
                </div>
              )}

              <div className="flex justify-between items-center">
                <div className="text-sm text-gray-500">
                  {profile.lastLogin 
                    ? `Dernière connexion: ${new Date(profile.lastLogin).toLocaleDateString("fr-FR")}`
                    : "Jamais connecté"
                  }
                </div>
                
                <div className="flex space-x-2">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleEdit(profile)}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleDelete(profile.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Edit Profile Dialog */}
      <Dialog open={!!editingProfile} onOpenChange={() => setEditingProfile(null)}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Modifier le Profil Utilisateur</DialogTitle>
            <DialogDescription>
              Modifiez les informations du profil utilisateur.
            </DialogDescription>
          </DialogHeader>
          
          {editingProfile && (
            <Form {...editForm}>
              <form onSubmit={editForm.handleSubmit(onEditSubmit)} className="space-y-4">
                <div className="bg-gray-50 dark:bg-gray-800 p-3 rounded-lg border">
                  <div className="text-sm font-medium text-gray-700 dark:text-gray-300 mb-1">
                    Nom d'utilisateur
                  </div>
                  <div className="text-gray-600 dark:text-gray-400">
                    {editingProfile.username}
                  </div>
                  <div className="text-xs text-gray-500 mt-1">
                    Le nom d'utilisateur ne peut pas être modifié
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input placeholder="Jean" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input placeholder="Dupont" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Email</FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="jean.dupont@entreprise.fr" {...field} value={field.value ?? ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="technician">Technicien</SelectItem>
                            <SelectItem value="supervisor">Superviseur</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="experienceLevel"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Niveau d'expérience</FormLabel>
                        <Select onValueChange={field.onChange} value={field.value ?? undefined}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Niveau d'expérience" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="beginner">Débutant</SelectItem>
                            <SelectItem value="intermediate">Intermédiaire</SelectItem>
                            <SelectItem value="expert">Expert</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <FormField
                    control={editForm.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Département</FormLabel>
                        <FormControl>
                          <Input placeholder="Ex: Maintenance" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={editForm.control}
                    name="phoneNumber"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Téléphone</FormLabel>
                        <FormControl>
                          <Input placeholder="+33 1 23 45 67 89" {...field} value={field.value ?? ""} />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={editForm.control}
                  name="isActive"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-3 shadow-sm">
                      <div className="space-y-0.5">
                        <FormLabel>Compte actif</FormLabel>
                        <FormDescription>
                          Permet à l'utilisateur de se connecter au système
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value ?? false}
                          onCheckedChange={field.onChange}
                        />
                      </FormControl>
                    </FormItem>
                  )}
                />

                <div className="flex justify-end space-x-2 pt-4">
                  <Button 
                    type="button" 
                    variant="outline" 
                    onClick={() => setEditingProfile(null)}
                  >
                    Annuler
                  </Button>
                  <Button 
                    type="submit" 
                    disabled={updateProfileMutation.isPending}
                  >
                    {updateProfileMutation.isPending ? "Mise à jour..." : "Mettre à jour"}
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}