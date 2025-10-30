/**
 * Gestion des pièces justificatives pour les bons de commande
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';
import { Request } from 'express';

// Créer le dossier de stockage s'il n'existe pas
const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'purchase-orders');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

// Configuration du stockage sur disque
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    // Générer un nom de fichier unique avec timestamp
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50);
    cb(null, `PO-${uniqueSuffix}-${basename}${ext}`);
  }
});

// Configuration multer pour pièces justificatives
export const uploadPurchaseOrderAttachments = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB par fichier
    files: 5, // Maximum 5 fichiers par bon de commande
  },
  fileFilter: (req, file, cb) => {
    // Types de fichiers acceptés pour les pièces justificatives
    const allowedMimes = [
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      // Texte
      'text/plain',
    ];

    const allowedExtensions = [
      '.pdf', '.doc', '.docx', '.xls', '.xlsx', 
      '.jpg', '.jpeg', '.png', '.gif', '.webp',
      '.txt'
    ];

    const isValidMime = allowedMimes.includes(file.mimetype);
    const ext = path.extname(file.originalname).toLowerCase();
    const isValidExtension = allowedExtensions.includes(ext);

    if (isValidMime || isValidExtension) {
      cb(null, true);
    } else {
      cb(new Error(`Type de fichier non autorisé. Formats acceptés: ${allowedExtensions.join(', ')}`));
    }
  }
});

/**
 * Interface pour les métadonnées de pièces justificatives
 */
export interface AttachmentMetadata {
  filename: string;
  originalName: string;
  mimeType: string;
  size: number;
  uploadedAt: string;
  uploadedBy?: number;
  path: string;
}

/**
 * Formater les métadonnées d'un fichier uploadé
 */
export function formatAttachmentMetadata(
  file: Express.Multer.File,
  uploadedBy?: number
): AttachmentMetadata {
  return {
    filename: file.filename,
    originalName: file.originalname,
    mimeType: file.mimetype,
    size: file.size,
    uploadedAt: new Date().toISOString(),
    uploadedBy,
    path: `/uploads/purchase-orders/${file.filename}`
  };
}

/**
 * Supprimer un fichier du système de fichiers
 */
export function deleteAttachment(filename: string): boolean {
  try {
    const filePath = path.join(UPLOAD_DIR, filename);
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
      return true;
    }
    return false;
  } catch (error) {
    console.error(`Erreur lors de la suppression du fichier ${filename}:`, error);
    return false;
  }
}

/**
 * Supprimer tous les fichiers d'un bon de commande
 */
export function deleteAllAttachments(attachments: AttachmentMetadata[]): void {
  attachments.forEach(attachment => {
    deleteAttachment(attachment.filename);
  });
}

/**
 * Obtenir le chemin complet d'un fichier
 */
export function getAttachmentPath(filename: string): string {
  return path.join(UPLOAD_DIR, filename);
}

/**
 * Vérifier si un fichier existe
 */
export function attachmentExists(filename: string): boolean {
  const filePath = path.join(UPLOAD_DIR, filename);
  return fs.existsSync(filePath);
}
