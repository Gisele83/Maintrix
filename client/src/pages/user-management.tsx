import React, { useState, useEffect } from 'react';
import { auMoins, libelleRole } from "@shared/roles";
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Form, FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Users, 
  UserPlus, 
  Shield, 
  AlertTriangle, 
  CheckCircle, 
  Clock, 
  Key,
  Mail,
  Copy,
  Eye,
  EyeOff,
  Loader2,
  UserCog,
  Plus
} from 'lucide-react';
import { apiRequest } from '@/lib/queryClient';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { AppShell, EnTetePage, ActionPrincipale, ActionSecondaire, EtatVide } from "@/components/app-shell";
import { Indicateur, RangeeIndicateurs, PuceEtat } from "@/components/indicateurs";
import { ETAT, type RegistreEtat } from "@/lib/etats";

const createUserSchema = z.object({
  email: z.string().email("Email invalide"),
  role: z.enum(['user', 'admin'], {
    errorMap: () => ({ message: "Le rôle doit être 'user' ou 'admin'" })
  }),
  firstName: z.string().min(1, "Prénom requis").optional(),
  lastName: z.string().min(1, "Nom requis").optional(),
  department: z.string().optional(),
  position: z.string().optional()
});

type CreateUserForm = z.infer<typeof createUserSchema>;

interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  firstName?: string;
  lastName?: string;
  department?: string;
  position?: string;
  accountStatus: string;
  isDefaultCredentials?: boolean;
  mustChangePassword?: boolean;
  needsPasswordChange?: boolean;
  passwordExpired?: boolean;
  lastLoginAt?: string;
  passwordExpiresAt?: string;
  createdAt: string;
}

interface CreatedUserResult {
  user: User;
  credentials: {
    username: string;
    temporaryPassword: string;
    expiresAt: string;
  };
  instructions: string[];
}

export default function UserManagement() {
  const { user: currentUser } = useAuth();
  const { toast } = useToast();
  const [users, setUsers] = useState<User[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [showCreateDialog, setShowCreateDialog] = useState(false);
  const [createdUserResult, setCreatedUserResult] = useState<CreatedUserResult | null>(null);
  const [showCredentials, setShowCredentials] = useState(false);

  const form = useForm<CreateUserForm>({
    resolver: zodResolver(createUserSchema),
    defaultValues: {
      email: '',
      role: 'user',
      firstName: '',
      lastName: '',
      department: '',
      position: ''
    }
  });

  // Vérifier si l'utilisateur actuel peut gérer les utilisateurs
  const canManageUsers = auMoins(currentUser?.role, 'admin');

  // Charger la liste des utilisateurs
  const fetchUsers = async () => {
    try {
      const data = await apiRequest('/api/enterprise-auth/admin/users');
      setUsers(data.users || []);
    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de charger les utilisateurs",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (canManageUsers) {
      fetchUsers();
    } else {
      setIsLoading(false);
    }
  }, [canManageUsers]);

  const onSubmit = async (data: CreateUserForm) => {
    setIsCreating(true);
    try {
      const result = await apiRequest('/api/enterprise-auth/admin/create-user', {
        method: 'POST',
        body: data
      });

      setCreatedUserResult(result);
      setShowCreateDialog(false);
      
      toast({
        title: "Utilisateur créé",
        description: `${result.user.email} a été créé avec des identifiants temporaires`,
      });

      // Rafraîchir la liste
      await fetchUsers();
      
      // Réinitialiser le formulaire
      form.reset();

    } catch (error: any) {
      toast({
        title: "Erreur",
        description: error.message || "Impossible de créer l'utilisateur",
        variant: "destructive",
      });
    } finally {
      setIsCreating(false);
    }
  };

  const copyToClipboard = (text: string, label: string) => {
    navigator.clipboard.writeText(text).then(() => {
      toast({
        title: "Copié",
        description: `${label} copié dans le presse-papiers`,
      });
    });
  };

  if (!canManageUsers) {
    return (
      <div className="container mx-auto p-6">
        <Alert className="border-etat-critique-filet bg-etat-critique-fond">
          <AlertTriangle className="h-4 w-4 text-etat-critique-texte" />
          <AlertDescription className="text-etat-critique-texte">
            <strong>Accès refusé.</strong> Seuls les administrateurs peuvent gérer les utilisateurs.
          </AlertDescription>
        </Alert>
      </div>
    );
  }

  if (isLoading) {
    return (
      <div className="container mx-auto p-6 flex items-center justify-center">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
          <p>Chargement des utilisateurs...</p>
        </div>
      </div>
    );
  }

  const activeUsers = users.filter(u => u.accountStatus === 'active');
  const usersNeedingPasswordChange = users.filter(u => u.needsPasswordChange || u.isDefaultCredentials);
  const expiredPasswordUsers = users.filter(u => u.passwordExpired);

  return (
    <AppShell filAriane={[{ libelle: "Administration" }, { libelle: "Utilisateurs" }]} largeur="large">
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-3">
          <UserCog className="w-8 h-8 text-etat-encours-texte" />
          <div>
            <h1 className="text-3xl font-bold text-ink">Gestion des utilisateurs</h1>
            <p className="text-lg text-ink-soft">Créer et gérer les comptes utilisateurs</p>
          </div>
        </div>
        
        <Dialog open={showCreateDialog} onOpenChange={setShowCreateDialog}>
          <DialogTrigger asChild>
            <Button className="bg-paper-deep">
              <UserPlus className="mr-2 h-4 w-4" />
              Créer un utilisateur
            </Button>
          </DialogTrigger>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle>Créer un nouvel utilisateur</DialogTitle>
              <DialogDescription>
                Un compte sera créé avec des identifiants temporaires. L'utilisateur devra les changer lors de sa première connexion.
              </DialogDescription>
            </DialogHeader>
            
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="email"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Email *</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="utilisateur@exemple.com" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="role"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Rôle *</FormLabel>
                        <Select onValueChange={field.onChange} defaultValue={field.value}>
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Sélectionner un rôle" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="user">Utilisateur</SelectItem>
                            <SelectItem value="admin">Administrateur</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Prénom</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Jean" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Nom</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Dupont" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="department"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Département</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Maintenance" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  
                  <FormField
                    control={form.control}
                    name="position"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Poste</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Technicien" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
                
                <Alert className="border-etat-encours-filet bg-etat-encours-fond">
                  <Key className="h-4 w-4 text-etat-encours-texte" />
                  <AlertDescription className="text-etat-encours-texte">
                    <strong>Sécurité :</strong> Des identifiants temporaires seront générés automatiquement et envoyés par email. 
                    L'utilisateur devra les changer lors de sa première connexion.
                  </AlertDescription>
                </Alert>
                
                <div className="flex justify-end space-x-4">
                  <Button type="button" variant="outline" onClick={() => setShowCreateDialog(false)}>
                    Annuler
                  </Button>
                  <Button type="submit" disabled={isCreating}>
                    {isCreating ? (
                      <>
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                        Création...
                      </>
                    ) : (
                      <>
                        <Plus className="mr-2 h-4 w-4" />
                        Créer l'utilisateur
                      </>
                    )}
                  </Button>
                </div>
              </form>
            </Form>
          </DialogContent>
        </Dialog>
      </div>

      {/* Statistiques */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-ink-soft">Total Utilisateurs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Users className="w-5 h-5 text-etat-encours-texte" />
              <span className="text-2xl font-bold">{users.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-ink-soft">Utilisateurs Actifs</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <CheckCircle className="w-5 h-5 text-etat-nominal-texte" />
              <span className="text-2xl font-bold">{activeUsers.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-ink-soft">Mot de passe à changer</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <AlertTriangle className="w-5 h-5 text-etat-alerte-texte" />
              <span className="text-2xl font-bold">{usersNeedingPasswordChange.length}</span>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-sm font-medium text-ink-soft">Mots de passe expirés</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-center space-x-2">
              <Clock className="w-5 h-5 text-etat-critique-texte" />
              <span className="text-2xl font-bold">{expiredPasswordUsers.length}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Alertes de sécurité */}
      {usersNeedingPasswordChange.length > 0 && (
        <Alert className="border-etat-alerte-filet bg-etat-alerte-fond">
          <AlertTriangle className="h-4 w-4 text-etat-alerte-texte" />
          <AlertDescription className="text-etat-alerte-texte">
            <strong>{usersNeedingPasswordChange.length} utilisateur(s)</strong> doivent changer leur mot de passe. 
            Contactez-les pour qu'ils se connectent et mettent à jour leurs identifiants.
          </AlertDescription>
        </Alert>
      )}

      {/* Table des utilisateurs */}
      <Card>
        <CardHeader>
          <CardTitle>Liste des utilisateurs</CardTitle>
          <CardDescription>
            Gérez tous les utilisateurs de votre organisation
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Utilisateur</TableHead>
                  <TableHead>Rôle</TableHead>
                  <TableHead>Statut</TableHead>
                  <TableHead>Sécurité</TableHead>
                  <TableHead>Dernière connexion</TableHead>
                  <TableHead>Créé le</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {users.map((user) => (
                  <TableRow key={user.id}>
                    <TableCell>
                      <div>
                        <div className="font-medium">{user.username}</div>
                        <div className="text-sm text-ink-mute">{user.email}</div>
                        {(user.firstName || user.lastName) && (
                          <div className="text-sm text-ink-mute">
                            {user.firstName} {user.lastName}
                          </div>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      <Badge variant={auMoins(user.role, 'admin') ? 'default' : 'secondary'}>
                        {libelleRole(user.role)}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <Badge 
                        variant={user.accountStatus === 'active' ? 'default' : 'destructive'}
                        className={user.accountStatus === 'active' ? 'bg-etat-nominal-fond text-etat-nominal-texte' : ''}
                      >
                        {user.accountStatus === 'active' ? 'Actif' : 'Inactif'}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="space-y-1">
                        {user.isDefaultCredentials && (
                          <Badge variant="outline" className="text-etat-alerte-texte border-etat-alerte-filet">
                            <Key className="w-3 h-3 mr-1" />
                            Identifiants par défaut
                          </Badge>
                        )}
                        {user.mustChangePassword && (
                          <Badge variant="outline" className="text-etat-critique-texte border-etat-critique-filet">
                            <AlertTriangle className="w-3 h-3 mr-1" />
                            Changement requis
                          </Badge>
                        )}
                        {user.passwordExpired && (
                          <Badge variant="destructive">
                            <Clock className="w-3 h-3 mr-1" />
                            Expiré
                          </Badge>
                        )}
                      </div>
                    </TableCell>
                    <TableCell>
                      {user.lastLoginAt ? (
                        new Date(user.lastLoginAt).toLocaleString('fr-FR')
                      ) : (
                        <span className="text-ink-mute">Jamais</span>
                      )}
                    </TableCell>
                    <TableCell>
                      {new Date(user.createdAt).toLocaleDateString('fr-FR')}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>

      {/* Dialog pour afficher les identifiants créés */}
      {createdUserResult && (
        <Dialog open={!!createdUserResult} onOpenChange={() => setCreatedUserResult(null)}>
          <DialogContent className="max-w-2xl">
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <CheckCircle className="w-6 h-6 text-etat-nominal-texte" />
                <span>Utilisateur créé avec succès</span>
              </DialogTitle>
              <DialogDescription>
                L'utilisateur {createdUserResult.user.email} a été créé avec des identifiants temporaires
              </DialogDescription>
            </DialogHeader>
            
            <div className="space-y-6">
              <Alert className="border-etat-nominal-filet bg-etat-nominal-fond">
                <Mail className="h-4 w-4 text-etat-nominal-texte" />
                <AlertDescription className="text-etat-nominal-texte">
                  Un email avec les identifiants a été envoyé à l'utilisateur.
                </AlertDescription>
              </Alert>
              
              <div className="bg-etat-encours-fond border border-etat-encours-filet rounded-lg p-4">
                <h3 className="font-semibold text-etat-encours-texte mb-3">Identifiants temporaires</h3>
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Nom d'utilisateur :</span>
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border">
                        {createdUserResult.credentials.username}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(createdUserResult.credentials.username, "Nom d'utilisateur")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Mot de passe temporaire :</span>
                    <div className="flex items-center space-x-2">
                      <code className="bg-white px-2 py-1 rounded border">
                        {showCredentials ? createdUserResult.credentials.temporaryPassword : '••••••••'}
                      </code>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => setShowCredentials(!showCredentials)}
                      >
                        {showCredentials ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="ghost" 
                        onClick={() => copyToClipboard(createdUserResult.credentials.temporaryPassword, "Mot de passe")}
                      >
                        <Copy className="w-4 h-4" />
                      </Button>
                    </div>
                  </div>
                  
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Expire le :</span>
                    <span className="text-sm">
                      {new Date(createdUserResult.credentials.expiresAt).toLocaleString('fr-FR')}
                    </span>
                  </div>
                </div>
              </div>
              
              <div className="bg-etat-alerte-fond border border-etat-alerte-filet rounded-lg p-4">
                <h4 className="font-semibold text-etat-alerte-texte mb-2">Instructions importantes</h4>
                <ul className="text-sm text-etat-alerte-texte space-y-1">
                  {createdUserResult.instructions.map((instruction, index) => (
                    <li key={index}>• {instruction}</li>
                  ))}
                </ul>
              </div>
            </div>
          </DialogContent>
        </Dialog>
      )}
    </div>
    </AppShell>
  );
}