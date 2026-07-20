/**
 * Upload de pièces jointes pour les étapes d'intervention (Maintenance Execution)
 * Même mécanisme que server/purchase-order-attachments.ts (multer, stockage disque).
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'interventions');
if (!fs.existsSync(UPLOAD_DIR)) {
  fs.mkdirSync(UPLOAD_DIR, { recursive: true });
}

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, UPLOAD_DIR);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    const ext = path.extname(file.originalname);
    const basename = path.basename(file.originalname, ext)
      .replace(/[^a-z0-9]/gi, '_')
      .substring(0, 50);
    cb(null, `IE-${uniqueSuffix}-${basename}${ext}`);
  }
});

export const uploadInterventionAttachment = multer({
  storage,
  limits: {
    fileSize: 15 * 1024 * 1024, // 15MB (photos haute résolution terrain)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    ];
    const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.mp4', '.mov', '.webm', '.pdf', '.doc', '.docx'];

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

/** Déduit le type d'attachment (photo/video/document) à partir du mimetype réel du fichier uploadé. */
export function inferAttachmentType(mimetype: string): "photo" | "video" | "document" {
  if (mimetype.startsWith("image/")) return "photo";
  if (mimetype.startsWith("video/")) return "video";
  return "document";
}

/** Chemin public (servi par express.static sur /uploads) du fichier uploadé. */
export function attachmentUrl(filename: string): string {
  return `/uploads/interventions/${filename}`;
}
