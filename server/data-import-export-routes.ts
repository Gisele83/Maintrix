import { Router, Request, Response } from "express";
import multer from "multer";
import { dataImportExportService } from "./data-import-export";
import { simpleImportService } from "./simple-import-service";

const router = Router();

// Configuration multer pour l'upload de fichiers avec limites de sécurité renforcées
const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: 5 * 1024 * 1024, // 5MB max (réduit pour la sécurité)
    files: 1, // Un seul fichier à la fois
    fieldSize: 1024 * 1024, // 1MB max pour les champs
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = [
      'text/csv',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/json'
    ];
    
    // Vérification stricte du type MIME
    if (!allowedTypes.includes(file.mimetype)) {
      return cb(new Error('Type de fichier non supporté. Utilisez CSV, Excel ou JSON.'));
    }
    
    // Vérification de l'extension de fichier pour éviter les uploads malveillants
    const allowedExtensions = ['.csv', '.xlsx', '.xls', '.json'];
    const fileExtension = file.originalname.toLowerCase().substring(file.originalname.lastIndexOf('.'));
    
    if (!allowedExtensions.includes(fileExtension)) {
      return cb(new Error('Extension de fichier non autorisée.'));
    }
    
    // Vérification du nom de fichier (pas de caractères dangereux)
    const dangerousChars = /[<>:"/\\|?*]/;
    if (dangerousChars.test(file.originalname)) {
      return cb(new Error('Nom de fichier contient des caractères non autorisés.'));
    }
    
    cb(null, true);
  }
});

// Route d'import de données
router.post('/import', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun fichier fourni' 
      });
    }

    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ 
        success: false,
        error: 'Type d\'import non spécifié' 
      });
    }

    const fileFormat = req.file.mimetype.includes('csv') ? 'csv' : 'excel';
    const tenantId = (req as any).user?.tenantId || 'default-tenant';
    let result;

    switch (type) {
      case 'equipments':
        result = await dataImportExportService.importEquipments(req.file.buffer, fileFormat, tenantId);
        break;
      case 'maintenance-history':
        result = await dataImportExportService.importMaintenanceHistory(req.file.buffer, fileFormat, tenantId);
        break;
      case 'spare-parts':
        result = await dataImportExportService.importSpareParts(req.file.buffer, fileFormat);
        break;
      default:
        return res.status(400).json({ 
          success: false,
          error: `Type d'import non supporté: ${type}` 
        });
    }

    res.json(result);
  } catch (error: any) {
    console.error('Erreur lors de l\'import:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Erreur interne du serveur' 
    });
  }
});

// Route d'export de données
router.get('/export', async (req: Request, res: Response) => {
  try {
    const { type, format = 'excel' } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'Type d\'export non spécifié' });
    }

    if (!['csv', 'excel'].includes(format as string)) {
      return res.status(400).json({ error: 'Format non supporté. Utilisez csv ou excel.' });
    }

    let buffer: Buffer;
    let filename: string;
    let contentType: string;

    const today = new Date().toISOString().split('T')[0];

    switch (type) {
      case 'equipments':
        buffer = await dataImportExportService.exportEquipments(format as 'csv' | 'excel');
        filename = `equipements_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        break;
      case 'maintenance-history':
        buffer = await dataImportExportService.exportMaintenanceHistory(format as 'csv' | 'excel');
        filename = `historique_maintenance_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        break;
      case 'spare-parts':
        buffer = await dataImportExportService.exportSpareParts(format as 'csv' | 'excel');
        filename = `pieces_detachees_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        break;
      case 'iot-data':
        const days = parseInt(req.query.days as string) || 30;
        buffer = await dataImportExportService.exportIoTData(format as 'csv' | 'excel', days);
        filename = `donnees_iot_${days}j_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        break;
      case 'work-orders':
        buffer = await dataImportExportService.exportMaintenanceHistory(format as 'csv' | 'excel');
        filename = `ordres_travail_${today}.${format === 'csv' ? 'csv' : 'xlsx'}`;
        break;
      default:
        return res.status(400).json({ error: `Type d'export non supporté: ${type}` });
    }

    // Définir le type de contenu approprié
    if (format === 'csv') {
      contentType = 'text/csv';
    } else {
      contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    }

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    
    res.send(buffer);
  } catch (error: any) {
    console.error('Erreur lors de l\'export:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur interne du serveur' 
    });
  }
});

// Route pour télécharger les templates
router.get('/template', async (req: Request, res: Response) => {
  try {
    const { type, format = 'excel' } = req.query;
    
    if (!type) {
      return res.status(400).json({ error: 'Type de template non spécifié' });
    }

    if (!['csv', 'excel'].includes(format as string)) {
      return res.status(400).json({ error: 'Format non supporté. Utilisez csv ou excel.' });
    }

    const buffer = dataImportExportService.generateTemplate(type as string, format as 'csv' | 'excel');
    const filename = `template_${type}.${format === 'csv' ? 'csv' : 'xlsx'}`;
    
    const contentType = format === 'csv' 
      ? 'text/csv' 
      : 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.setHeader('Content-Length', buffer.length.toString());
    
    res.send(buffer);
  } catch (error: any) {
    console.error('Erreur lors de la génération du template:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur interne du serveur' 
    });
  }
});

// Route pour obtenir l'historique des imports/exports
router.get('/import-history', async (req: Request, res: Response) => {
  try {
    // Simulation d'un historique d'imports/exports
    // Dans une vraie application, ceci serait stocké en base de données
    const history = [
      {
        id: 1,
        type: 'import',
        dataType: 'equipments',
        filename: 'equipements_janvier.xlsx',
        status: 'success',
        recordCount: 45,
        timestamp: new Date('2024-01-15T10:30:00'),
        errors: []
      },
      {
        id: 2,
        type: 'export',
        dataType: 'maintenance-history',
        filename: 'historique_maintenance_2024-01-10.csv',
        status: 'success',
        recordCount: 128,
        timestamp: new Date('2024-01-10T14:20:00'),
        errors: []
      },
      {
        id: 3,
        type: 'import',
        dataType: 'spare-parts',
        filename: 'pieces_detachees.xlsx',
        status: 'error',
        recordCount: 0,
        timestamp: new Date('2024-01-08T09:15:00'),
        errors: ['Format de fichier invalide', 'Colonnes manquantes: partNumber, partName']
      }
    ];
    
    res.json(history);
  } catch (error: any) {
    console.error('Erreur lors de la récupération de l\'historique:', error);
    res.status(500).json({ 
      error: error.message || 'Erreur interne du serveur' 
    });
  }
});

// Route pour valider un fichier avant import
router.post('/validate', upload.single('file'), async (req: Request, res: Response) => {
  try {
    if (!req.file) {
      return res.status(400).json({ 
        success: false,
        error: 'Aucun fichier fourni' 
      });
    }

    const { type } = req.body;
    if (!type) {
      return res.status(400).json({ 
        success: false,
        error: 'Type de validation non spécifié' 
      });
    }

    // Validation du format de fichier
    const fileFormat = req.file.mimetype.includes('csv') ? 'csv' : 'excel';
    
    // Ici, on pourrait ajouter une validation plus poussée du contenu
    // sans effectuer l'import réel
    
    const validation = {
      success: true,
      format: fileFormat,
      size: req.file.size,
      estimatedRecords: 0,
      warnings: [] as string[],
      errors: [] as string[]
    };

    // Analyse rapide du contenu pour estimer le nombre d'enregistrements
    try {
      if (fileFormat === 'csv') {
        const csvContent = req.file.buffer.toString('utf-8');
        const lines = csvContent.split('\n').filter(line => line.trim());
        validation.estimatedRecords = Math.max(0, lines.length - 1); // -1 pour les headers
      } else {
        const XLSX = require('xlsx');
        const workbook = XLSX.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const worksheet = workbook.Sheets[sheetName];
        const records = XLSX.utils.sheet_to_json(worksheet);
        validation.estimatedRecords = records.length;
      }
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      validation.errors.push(`Erreur d'analyse du fichier: ${errorMessage}`);
      validation.success = false;
    }

    res.json(validation);
  } catch (error: any) {
    console.error('Erreur lors de la validation:', error);
    res.status(500).json({ 
      success: false,
      error: error.message || 'Erreur interne du serveur' 
    });
  }
});

export { router as dataImportExportRoutes };