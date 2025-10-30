# 📎 Guide - Pièces Justificatives pour Bons de Commande - Maintrix

## 📋 **Vue d'Ensemble**

Le système de pièces justificatives permet d'attacher des documents aux bons de commande lors de leur émission. Cela facilite la justification des achats et améliore la traçabilité.

---

## ✨ **Fonctionnalités**

### **Côté Utilisateur (Frontend)**

✅ **Upload de fichiers lors de la création du bon de commande**
- Interface intuitive avec bouton "Ajouter des fichiers"
- Aperçu des fichiers sélectionnés avant soumission
- Suppression individuelle des fichiers avant envoi
- Badge compteur sur le bouton de soumission

✅ **Validation automatique**
- Maximum 5 fichiers par bon de commande
- Taille maximale : 10MB par fichier
- Formats acceptés : PDF, Word, Excel, Images, TXT

✅ **Gestion des pièces jointes**
- Consultation de la liste des pièces justificatives
- Téléchargement de chaque document
- Suppression de documents si nécessaire

---

## 📝 **Formats Acceptés**

| Type de Document | Extensions | Usage Recommandé |
|------------------|------------|------------------|
| **PDF** | `.pdf` | Devis, factures, spécifications |
| **Word** | `.doc`, `.docx` | Demandes, spécifications |
| **Excel** | `.xls`, `.xlsx` | Listes de pièces, devis détaillés |
| **Images** | `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp` | Photos produits, croquis |
| **Texte** | `.txt` | Notes, spécifications simples |

---

## 💻 **Utilisation Côté Frontend**

### **1. Création d'un Bon de Commande avec Pièces Justificatives**

```typescript
// Composant PurchaseOrderCreator.tsx

// 1. Sélectionner des fichiers
<input type="file" multiple accept=".pdf,.doc,..." onChange={handleFileChange} />

// 2. Afficher la liste des fichiers
{selectedFiles.map((file, index) => (
  <div>
    <span>{file.name}</span>
    <span>{(file.size / 1024).toFixed(1)} KB</span>
    <button onClick={() => removeFile(index)}>Supprimer</button>
  </div>
))}

// 3. Upload automatique après création
const createOrderMutation = useMutation({
  onSuccess: async (response) => {
    if (selectedFiles.length > 0 && response.id) {
      await uploadAttachments(response.id); // Upload automatique
    }
  }
});

// 4. Fonction d'upload
const uploadAttachments = async (orderId: number) => {
  const formData = new FormData();
  selectedFiles.forEach(file => {
    formData.append('attachments', file);
  });

  await fetch(`/api/procurement/purchase-orders/${orderId}/attachments`, {
    method: 'POST',
    body: formData,
  });
};
```

### **2. Affichage et Téléchargement de Pièces Justificatives**

```typescript
// Récupérer la liste des pièces jointes
const { data: attachments } = useQuery({
  queryKey: ['/api/procurement/purchase-orders', orderId, 'attachments'],
  queryFn: () => apiRequest(`/api/procurement/purchase-orders/${orderId}/attachments`)
});

// Afficher la liste
{attachments?.map(attachment => (
  <div key={attachment.filename}>
    <span>{attachment.originalName}</span>
    <span>{(attachment.size / 1024).toFixed(1)} KB</span>
    <a href={`/api/procurement/purchase-orders/${orderId}/attachments/${attachment.filename}`}>
      Télécharger
    </a>
  </div>
))}
```

---

## 🔧 **API Backend**

### **1. Upload de Pièces Justificatives**

**Endpoint :** `POST /api/procurement/purchase-orders/:id/attachments`

**Headers :**
```
Content-Type: multipart/form-data
```

**Body (FormData) :**
```javascript
formData.append('attachments', file1);
formData.append('attachments', file2);
// ... jusqu'à 5 fichiers
```

**Réponse :**
```json
{
  "message": "3 fichier(s) uploadé(s) avec succès",
  "attachments": [
    {
      "filename": "PO-1738348800000-123456789-devis.pdf",
      "originalName": "devis.pdf",
      "mimeType": "application/pdf",
      "size": 245678,
      "uploadedAt": "2025-01-31T12:00:00.000Z",
      "uploadedBy": 1,
      "path": "/uploads/purchase-orders/PO-1738348800000-123456789-devis.pdf"
    }
  ],
  "totalAttachments": 3
}
```

---

### **2. Liste des Pièces Justificatives**

**Endpoint :** `GET /api/procurement/purchase-orders/:id/attachments`

**Réponse :**
```json
[
  {
    "filename": "PO-1738348800000-123456789-devis.pdf",
    "originalName": "devis.pdf",
    "mimeType": "application/pdf",
    "size": 245678,
    "uploadedAt": "2025-01-31T12:00:00.000Z",
    "uploadedBy": 1,
    "path": "/uploads/purchase-orders/PO-1738348800000-123456789-devis.pdf"
  }
]
```

---

### **3. Téléchargement d'une Pièce Justificative**

**Endpoint :** `GET /api/procurement/purchase-orders/:id/attachments/:filename`

**Exemple :**
```
GET /api/procurement/purchase-orders/42/attachments/PO-1738348800000-123456789-devis.pdf
```

**Réponse :** Téléchargement du fichier avec le nom original

---

### **4. Suppression d'une Pièce Justificative**

**Endpoint :** `DELETE /api/procurement/purchase-orders/:id/attachments/:filename`

**Exemple :**
```
DELETE /api/procurement/purchase-orders/42/attachments/PO-1738348800000-123456789-devis.pdf
```

**Réponse :**
```json
{
  "message": "Attachment deleted successfully",
  "remainingAttachments": 2
}
```

---

## 🗃️ **Stockage des Fichiers**

### **Structure de Stockage**

Les fichiers sont sauvegardés dans :
```
uploads/
  └── purchase-orders/
      ├── PO-1738348800000-123456789-devis.pdf
      ├── PO-1738348800000-987654321-specification.docx
      └── PO-1738348800000-111222333-photo.jpg
```

### **Nomenclature des Fichiers**

Format : `PO-{timestamp}-{random}-{originalName}`

Exemple : `PO-1738348800000-123456789-devis.pdf`

- `PO` : Préfixe Purchase Order
- `1738348800000` : Timestamp Unix (millisecondes)
- `123456789` : Nombre aléatoire
- `devis.pdf` : Nom original du fichier (caractères nettoyés)

---

## 🛡️ **Sécurité**

### **Validation Côté Client**

```typescript
// Vérification nombre de fichiers
if (selectedFiles.length + newFiles.length > 5) {
  toast.error("Maximum 5 fichiers autorisés");
  return;
}

// Vérification taille fichiers
const invalidFiles = files.filter(f => f.size > 10 * 1024 * 1024);
if (invalidFiles.length > 0) {
  toast.error("Taille maximale : 10MB par fichier");
  return;
}
```

### **Validation Côté Serveur**

```typescript
// Configuration multer
const upload = multer({
  storage: diskStorage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB max
    files: 5, // 5 fichiers max
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'application/pdf',
      'application/msword',
      // ...
    ];
    
    const allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx',
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.txt'
    ];
    
    if (allowedMimes.includes(file.mimetype) || 
        allowedExtensions.some(ext => file.originalname.endsWith(ext))) {
      cb(null, true);
    } else {
      cb(new Error('Type de fichier non autorisé'));
    }
  }
});
```

### **Vérification d'Appartenance**

Avant de télécharger ou supprimer un fichier, le système vérifie que :
1. Le bon de commande existe
2. Le fichier appartient bien à ce bon de commande
3. Le fichier existe sur le disque

---

## 📊 **Base de Données**

### **Champ documentsJustificatifs**

Le champ `documentsJustificatifs` dans la table `purchase_orders` est de type `jsonb` et contient un tableau d'objets :

```typescript
interface AttachmentMetadata {
  filename: string;           // Nom unique du fichier sur le serveur
  originalName: string;       // Nom original du fichier
  mimeType: string;          // Type MIME du fichier
  size: number;              // Taille en octets
  uploadedAt: string;        // Date d'upload (ISO string)
  uploadedBy?: number;       // ID utilisateur qui a uploadé
  path: string;              // Chemin relatif du fichier
}
```

**Exemple de données :**
```json
[
  {
    "filename": "PO-1738348800000-123456789-devis.pdf",
    "originalName": "devis.pdf",
    "mimeType": "application/pdf",
    "size": 245678,
    "uploadedAt": "2025-01-31T12:00:00.000Z",
    "uploadedBy": 1,
    "path": "/uploads/purchase-orders/PO-1738348800000-123456789-devis.pdf"
  },
  {
    "filename": "PO-1738348800000-987654321-specification.docx",
    "originalName": "specification_technique.docx",
    "mimeType": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "size": 512345,
    "uploadedAt": "2025-01-31T12:05:00.000Z",
    "uploadedBy": 1,
    "path": "/uploads/purchase-orders/PO-1738348800000-987654321-specification.docx"
  }
]
```

---

## 🎯 **Workflow Complet**

### **Émission d'un Bon de Commande avec Pièces Justificatives**

1. **Utilisateur remplit le formulaire** :
   - Service utilisateur
   - Type de commande
   - Objet et description
   - Montant total
   - Priorité et fournisseur

2. **Utilisateur joint des pièces justificatives** :
   - Clique sur "Ajouter des fichiers"
   - Sélectionne 1 à 5 fichiers (max 10MB chacun)
   - Voit la liste des fichiers avec tailles
   - Peut supprimer des fichiers avant envoi

3. **Utilisateur soumet le formulaire** :
   - Le bon de commande est créé en base de données
   - Les fichiers sont automatiquement uploadés
   - Les métadonnées sont sauvegardées dans le champ `documentsJustificatifs`
   - Toast de confirmation affiché

4. **Validation du bon de commande** :
   - Les validateurs peuvent voir et télécharger les pièces justificatives
   - Aide à la prise de décision (validation/rejet)

5. **Consultation ultérieure** :
   - Liste des pièces justificatives accessible
   - Téléchargement de chaque document
   - Suppression possible si nécessaire

---

## 🔍 **Exemples de Cas d'Usage**

### **Cas 1 : Commande de Pièces de Rechange**

**Documents joints :**
- Devis fournisseur (PDF)
- Spécifications techniques (PDF)
- Photo des pièces actuelles (JPEG)

### **Cas 2 : Commande de Services**

**Documents joints :**
- Proposition commerciale (DOCX)
- Cahier des charges (PDF)
- Planning d'intervention (XLSX)

### **Cas 3 : Commande de Maintenance**

**Documents joints :**
- Rapport de diagnostic (PDF)
- Photos de l'équipement (JPEG)
- Devis réparation (PDF)

---

## 🐛 **Dépannage**

### **Problème : "Type de fichier non autorisé"**

**Vérifier :**
- Le fichier a bien une extension valide : `.pdf`, `.doc`, `.docx`, `.xls`, `.xlsx`, `.jpg`, `.jpeg`, `.png`, `.gif`, `.webp`, `.txt`
- Le type MIME du fichier est correct

### **Problème : "Fichier trop volumineux"**

**Solution :**
- Réduire la taille du fichier (compression PDF, optimisation images)
- Limite maximale : 10MB par fichier

### **Problème : "Trop de fichiers"**

**Solution :**
- Regrouper plusieurs documents en un seul PDF
- Limite maximale : 5 fichiers par bon de commande

### **Problème : "Upload failed"**

**Vérifier :**
1. Le bon de commande a bien été créé
2. La connexion réseau est stable
3. Les logs du serveur pour plus de détails

---

## 📞 **Support**

Pour toute question sur le système de pièces justificatives :
- 📧 Email : support@maintrix-t.com
- 📚 Documentation : https://maintrix-t.com/docs/pieces-justificatives

---

**✅ Votre système de pièces justificatives Maintrix est maintenant opérationnel !**
