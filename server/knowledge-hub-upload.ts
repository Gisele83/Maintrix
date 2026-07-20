/**
 * Upload de documents pour l'Engineering Knowledge Hub.
 * Même mécanisme que server/purchase-order-attachments.ts et
 * server/intervention-attachments-upload.ts (multer, stockage disque).
 */

import multer from 'multer';
import path from 'path';
import fs from 'fs';

const UPLOAD_DIR = path.join(process.cwd(), 'uploads', 'knowledge-hub');
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
    cb(null, `KH-${uniqueSuffix}-${basename}${ext}`);
  }
});

export const uploadKnowledgeHubDocument = multer({
  storage,
  limits: {
    fileSize: 25 * 1024 * 1024, // 25MB (plans/schémas haute résolution, PDF de normes)
    files: 1,
  },
  fileFilter: (req, file, cb) => {
    const allowedMimes = [
      'image/jpeg', 'image/png', 'image/gif', 'image/webp', 'image/svg+xml',
      'video/mp4', 'video/quicktime', 'video/webm',
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ];
    const allowedExtensions = [
      '.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg',
      '.mp4', '.mov', '.webm', '.pdf', '.doc', '.docx', '.xls', '.xlsx',
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

export function knowledgeHubFileUrl(filename: string): string {
  return `/uploads/knowledge-hub/${filename}`;
}
