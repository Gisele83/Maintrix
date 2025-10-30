# 🔐 Guide RBAC - Contrôle d'Accès Basé sur les Rôles - Maintrix

## 📋 **Vue d'Ensemble**

Le système RBAC (Role-Based Access Control) de Maintrix permet de limiter l'accès de chaque utilisateur aux fonctionnalités pertinentes selon son rôle, protégeant ainsi les données de l'entreprise et améliorant l'expérience utilisateur.

---

## 👥 **Rôles Disponibles**

| Rôle | Clé | Niveau | Description |
|------|-----|--------|-------------|
| **Technicien** | `technician` | 1 | Accès limité à ses propres interventions |
| **Chef d'Équipe** | `team_leader` | 2 | Gestion d'une équipe ou d'un secteur géographique |
| **Planificateur** | `planner` | 3 | Planification et historique des interventions |
| **Achats/Magasin** | `procurement` | 3 | Gestion du stock et des achats |
| **Responsable Maintenance** | `maintenance_manager` | 4 | Vue globale sur toutes les activités de maintenance |
| **Directeur Technique** | `technical_director` | 5 | Accès complet à toutes les fonctionnalités |
| **Administrateur** | `admin` | 6 | Administration complète du système |

---

## 🔑 **Matrice des Permissions**

### **TECHNICIEN**
✅ Voir ses propres interventions  
✅ Modifier ses propres interventions  
✅ Consulter les équipements  
✅ Utiliser le diagnostic IA  
✅ Voir l'historique diagnostic  
✅ Consulter le stock (lecture seule)  
✅ Voir ses propres rapports  

### **CHEF D'ÉQUIPE**
✅ Toutes les permissions Technicien  
✅ Voir les interventions de son secteur/département  
✅ Modifier les interventions de son équipe  
✅ Créer des interventions  
✅ Créer/modifier des équipements  
✅ Voir la maintenance préventive  
✅ Voir les rapports de son équipe  

### **PLANIFICATEUR**
✅ Voir toutes les interventions  
✅ Créer/modifier des interventions  
✅ Créer/modifier des équipements  
✅ Gérer la maintenance préventive  
✅ Accès complet à la planification  
✅ Voir tout l'historique  
✅ Voir tous les rapports  
✅ Consulter le stock  

### **ACHATS/MAGASIN**
✅ Gérer le stock complet  
✅ Créer/valider bons de commande  
✅ Voir les interventions (lecture seule)  
✅ Voir les équipements  
✅ Voir le budget  
✅ Voir ses rapports  

### **RESPONSABLE MAINTENANCE**
✅ Toutes les permissions Planificateur  
✅ Supprimer des interventions  
✅ Valider des interventions  
✅ Supprimer des équipements  
✅ Supprimer maintenance préventive  
✅ Exporter tous les rapports  
✅ Voir les bons de commande  
✅ Voir le budget  

### **DIRECTEUR TECHNIQUE**
✅ Toutes les permissions Responsable Maintenance  
✅ Gérer le budget  
✅ Gérer les utilisateurs  
✅ Gérer les paramètres système  
✅ Voir les logs d'audit  
✅ Gérer le stock  
✅ Valider les bons de commande  

### **ADMINISTRATEUR**
✅ **Accès complet à toutes les fonctionnalités**

---

## 💻 **Utilisation Côté Backend**

### **1. Protéger une Route API**

```typescript
import { requirePermission, requireRole } from "./rbac-middleware";

// Protéger par permission
router.post('/work-orders', 
  requirePermission('create_work_orders'), 
  async (req, res) => {
    // ...
  }
);

// Protéger par rôle
router.delete('/work-orders/:id',
  requireRole('maintenance_manager', 'technical_director', 'admin'),
  async (req, res) => {
    // ...
  }
);

// Permissions multiples (AU MOINS UNE)
router.get('/reports',
  requireAnyPermission('view_own_reports', 'view_all_reports'),
  async (req, res) => {
    // ...
  }
);

// Permissions multiples (TOUTES REQUISES)
router.post('/budget',
  requireAllPermissions('view_budget', 'manage_budget'),
  async (req, res) => {
    // ...
  }
);
```

### **2. Filtrer les Données selon le Rôle**

```typescript
import { filterWorkOrdersByRole, checkWorkOrderAccess } from "./rbac-middleware";

// Filtrer automatiquement les interventions
router.get('/work-orders',
  filterWorkOrdersByRole(),
  async (req: RBACRequest, res) => {
    // req.query contient maintenant les filtres selon le rôle
    // Technicien: assignedTo=userId
    // Chef d'équipe: department=userDept
    // Autres: scope=all
  }
);

// Vérifier l'accès à une intervention spécifique
router.get('/work-orders/:id',
  checkWorkOrderAccess(async (id) => {
    return await storage.getWorkOrder(id);
  }),
  async (req: RBACRequest, res) => {
    // L'intervention est déjà chargée dans (req as any).workOrder
  }
);
```

### **3. Vérifier les Permissions en Code**

```typescript
import { hasPermission, canAccessWorkOrder } from "./rbac-permissions";

// Vérifier permission
if (hasPermission(user.role, "create_equipment")) {
  // Autoriser création
}

// Vérifier accès intervention
const canAccess = canAccessWorkOrder(
  user.role,
  user.id,
  {
    assignedTo: workOrder.assignedTo,
    department: workOrder.department
  },
  user.department
);
```

---

## ⚛️ **Utilisation Côté Frontend (React)**

### **1. Hook usePermissions**

```typescript
import { usePermissions } from "@/hooks/use-permissions";

function MyComponent() {
  const { 
    hasPermission, 
    hasAnyPermission, 
    canAccessRoute,
    user,
    permissions 
  } = usePermissions();

  // Vérifier une permission
  if (hasPermission("create_work_orders")) {
    // Afficher bouton créer
  }

  // Vérifier plusieurs permissions
  if (hasAnyPermission("view_own_reports", "view_all_reports")) {
    // Afficher section rapports
  }

  // Vérifier accès route
  if (canAccessRoute("budget")) {
    // Afficher lien vers budget
  }

  return (
    <div>
      <p>Utilisateur: {user?.username}</p>
      <p>Rôle: {user?.role}</p>
      <p>Permissions: {permissions.length}</p>
    </div>
  );
}
```

### **2. Composant Can (Affichage Conditionnel)**

```typescript
import { Can } from "@/components/rbac";

function Dashboard() {
  return (
    <div>
      {/* Afficher si permission */}
      <Can permission="create_work_orders">
        <button>Créer Intervention</button>
      </Can>

      {/* Afficher si AU MOINS UNE permission */}
      <Can anyPermission={["view_own_reports", "view_all_reports"]}>
        <ReportsSection />
      </Can>

      {/* Afficher si TOUTES les permissions */}
      <Can allPermissions={["view_budget", "manage_budget"]}>
        <BudgetManagement />
      </Can>

      {/* Avec fallback */}
      <Can 
        permission="manage_users"
        fallback={<p>Accès refusé</p>}
      >
        <UserManagement />
      </Can>
    </div>
  );
}
```

### **3. Composant ProtectedRoute (Protection de Pages)**

```typescript
import { ProtectedRoute } from "@/components/rbac";

function App() {
  return (
    <Routes>
      {/* Route protégée par permission */}
      <Route path="/users">
        <ProtectedRoute permission="manage_users">
          <UserManagement />
        </ProtectedRoute>
      </Route>

      {/* Route protégée par plusieurs permissions */}
      <Route path="/budget">
        <ProtectedRoute anyPermission={["view_budget", "manage_budget"]}>
          <BudgetPage />
        </ProtectedRoute>
      </Route>

      {/* Avec fallback personnalisé */}
      <Route path="/admin">
        <ProtectedRoute 
          permission="manage_settings"
          fallback={<AccessDeniedPage />}
        >
          <AdminSettings />
        </ProtectedRoute>
      </Route>
    </Routes>
  );
}
```

### **4. Navigation Basée sur les Rôles**

```typescript
import { RoleBasedNavigation } from "@/components/rbac";

function Sidebar() {
  return (
    <div className="sidebar">
      {/* Affiche automatiquement uniquement les rubriques accessibles */}
      <RoleBasedNavigation />
    </div>
  );
}
```

---

## 🗄️ **Migration des Rôles Existants**

Pour migrer les anciens rôles vers le nouveau système :

```sql
-- Exécuter le script de migration
\i server/migrate-roles.sql
```

Ou manuellement :

```sql
-- supervisor → team_leader
UPDATE user_profiles SET role = 'team_leader' WHERE role = 'supervisor';

-- manager → maintenance_manager
UPDATE user_profiles SET role = 'maintenance_manager' WHERE role = 'manager';

-- director → technical_director
UPDATE user_profiles SET role = 'technical_director' WHERE role = 'director';
```

---

## 📊 **API Endpoints**

### **GET /api/rbac/permissions**
Récupérer les permissions de l'utilisateur connecté

**Réponse :**
```json
{
  "success": true,
  "user": {
    "id": 1,
    "username": "jean.technicien",
    "role": "technician",
    "department": "Maintenance"
  },
  "permissions": [
    "view_own_work_orders",
    "edit_own_work_orders",
    "view_equipment",
    "use_diagnostic_ai"
  ],
  "navigation": [
    { "key": "diagnostic", "label": "Smart Diagnostic", "accessible": true },
    { "key": "interventions", "label": "Interventions", "accessible": true }
  ]
}
```

### **GET /api/rbac/roles**
Liste tous les rôles disponibles

### **GET /api/rbac/check/:permission**
Vérifier si l'utilisateur a une permission spécifique

---

## 🔒 **Principes de Sécurité**

### **1. Isolation des Données**

- **Technicien** : Voit uniquement ses interventions (`assignedTo = userId`)
- **Chef d'équipe** : Voit son département/secteur (`department = userDept`)
- **Autres** : Vue globale avec permissions appropriées

### **2. Hiérarchie des Rôles**

```
Technicien (1)
    ↓
Chef d'Équipe (2)
    ↓
Planificateur / Achats (3)
    ↓
Responsable Maintenance (4)
    ↓
Directeur Technique (5)
    ↓
Admin (6)
```

### **3. Principe du Moindre Privilège**

Chaque utilisateur a **uniquement** les permissions nécessaires à son activité.

---

## ✅ **Checklist d'Implémentation**

### **Backend**
- [x] Définir les rôles et permissions (`rbac-permissions.ts`)
- [x] Créer les middlewares RBAC (`rbac-middleware.ts`)
- [x] Créer les routes API (`rbac-routes.ts`)
- [x] Intégrer dans `routes.ts`
- [x] Migrer les rôles existants en base

### **Frontend**
- [x] Créer le hook `usePermissions`
- [x] Créer le composant `Can`
- [x] Créer le composant `ProtectedRoute`
- [x] Créer le composant `RoleBasedNavigation`

### **Database**
- [x] Ajouter colonne `sector` à `user_profiles`
- [x] Mettre à jour commentaires rôles

---

## 📝 **Exemples Complets**

### **Exemple 1 : Page Interventions avec Permissions**

```typescript
import { Can } from "@/components/rbac";
import { usePermissions } from "@/hooks/use-permissions";

function WorkOrdersPage() {
  const { hasPermission, user } = usePermissions();
  const canCreate = hasPermission("create_work_orders");
  const canEdit = hasPermission("edit_all_work_orders");

  return (
    <div>
      <h1>Mes Interventions</h1>
      
      <Can permission="create_work_orders">
        <button>Nouvelle Intervention</button>
      </Can>

      <WorkOrdersList 
        scope={user?.role === "technician" ? "own" : "all"}
        canEdit={canEdit}
      />
    </div>
  );
}
```

### **Exemple 2 : Route API Sécurisée**

```typescript
import { requirePermission, canModifyResource } from "./rbac-middleware";

// Créer intervention
router.post('/work-orders',
  requirePermission('create_work_orders'),
  async (req: RBACRequest, res) => {
    const workOrder = await storage.createWorkOrder({
      ...req.body,
      createdBy: req.user!.id
    });
    res.json(workOrder);
  }
);

// Modifier intervention (vérification accès)
router.put('/work-orders/:id',
  canModifyResource('work_order', async (id) => {
    return await storage.getWorkOrder(id);
  }),
  async (req: RBACRequest, res) => {
    const workOrder = (req as any).work_order; // Déjà chargé
    const updated = await storage.updateWorkOrder(workOrder.id, req.body);
    res.json(updated);
  }
);
```

---

## 🎯 **Bonnes Pratiques**

### **1. Toujours Vérifier Côté Backend**

❌ **MAUVAIS** : Vérifier uniquement côté frontend
```typescript
// NE PAS FAIRE ÇA
if (hasPermission("delete_work_orders")) {
  await fetch('/api/work-orders/123', { method: 'DELETE' });
}
```

✅ **BON** : Vérifier côté backend aussi
```typescript
// API Route
router.delete('/work-orders/:id',
  requirePermission('delete_work_orders'), // Protection backend
  async (req, res) => {
    // ...
  }
);
```

### **2. Utiliser des Composants Réutilisables**

```typescript
// Créer un composant ActionButton
function ActionButton({ permission, onClick, children }) {
  return (
    <Can permission={permission}>
      <button onClick={onClick}>{children}</button>
    </Can>
  );
}

// Utiliser
<ActionButton permission="create_work_orders" onClick={handleCreate}>
  Créer
</ActionButton>
```

### **3. Centraliser la Configuration**

Toutes les permissions sont définies dans `rbac-permissions.ts` - **une seule source de vérité**.

---

## 🐛 **Dépannage**

### **Problème : Permission refusée alors qu'elle devrait être accordée**

**Vérifier :**
1. Le rôle de l'utilisateur : `SELECT role FROM user_profiles WHERE id = ?`
2. La définition de la permission dans `ROLE_PERMISSIONS`
3. L'orthographe exacte de la permission

### **Problème : Navigation n'affiche aucune rubrique**

**Vérifier :**
1. L'utilisateur est bien authentifié
2. Les permissions sont bien chargées : `console.log(permissions)`
3. Les routes sont définies dans `NAVIGATION_ITEMS`

### **Problème : Migration des rôles échouée**

**Solution :**
```sql
-- Voir les rôles actuels
SELECT DISTINCT role FROM user_profiles;

-- Mapper manuellement
UPDATE user_profiles SET role = 'NOUVEAU_ROLE' WHERE role = 'ANCIEN_ROLE';
```

---

## 📞 **Support**

Pour toute question sur le système RBAC :
- 📧 Email : support@maintrix-t.com
- 📚 Documentation : https://maintrix-t.com/docs/rbac

---

**✅ Votre système RBAC Maintrix est maintenant opérationnel !**
