// =================================================================
// COMPARTIMENTAGE S3/MINIO PAR TENANT
// =================================================================
// Objectif 3: Isolation des fichiers avec structure gmao/{tenant_id}/*
// Politiques de bucket strictes et accès contrôlé

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import path from 'path';
import { db } from "./db";
import { sql } from "drizzle-orm";

// Configuration S3/MinIO — validation de l'environnement
const S3_ENDPOINT = process.env.S3_ENDPOINT || 'http://localhost:9000';
const S3_ACCESS_KEY = process.env.S3_ACCESS_KEY_ID || 'minioadmin';
const S3_SECRET_KEY = process.env.S3_SECRET_ACCESS_KEY || 'minioadmin';

if (process.env.NODE_ENV === 'production') {
  if (!process.env.S3_ENDPOINT) {
    console.error('⚠️ SECURITY: S3_ENDPOINT non défini en production — stockage de fichiers non fonctionnel');
  }
  if (!process.env.S3_ACCESS_KEY_ID || !process.env.S3_SECRET_ACCESS_KEY) {
    console.error('⚠️ SECURITY: Credentials S3 (S3_ACCESS_KEY_ID / S3_SECRET_ACCESS_KEY) non définis — credentials par défaut MinIO utilisés');
  }
  if (!process.env.S3_BUCKET_NAME) {
    console.warn('⚠️ S3_BUCKET_NAME non défini — bucket par défaut utilisé');
  }
}

const S3_CONFIG = {
  endpoint: S3_ENDPOINT,
  region: process.env.S3_REGION || 'us-east-1',
  credentials: {
    accessKeyId: S3_ACCESS_KEY,
    secretAccessKey: S3_SECRET_KEY,
  },
  forcePathStyle: true, // Requis pour MinIO et S3-compatible
};

// Client S3 configuré
const s3Client = new S3Client(S3_CONFIG);

// Types de fichiers par tenant
export enum TenantFileType {
  MAINTENANCE_DOCUMENT = 'maintenance_documents',
  DIAGNOSTIC_IMAGE = 'diagnostic_images', 
  USER_UPLOAD = 'user_uploads',
  REPORT_PDF = 'reports',
  MODEL_BACKUP = 'ml_models',
  AUDIT_EXPORT = 'audit_exports'
}

// Métadonnées de fichier
interface TenantFileMetadata {
  tenantId: string;
  fileType: TenantFileType;
  fileName: string;
  fileSize: number;
  contentType: string;
  uploadedBy: string;
  uploadedAt: Date;
  s3Key: string;
  bucket: string;
  encrypted: boolean;
  accessLevel: 'private' | 'tenant' | 'public';
}

export class S3CompartmentalizationService {
  private static readonly BASE_BUCKET = process.env.S3_BUCKET_NAME || 'smartgmao-multitenant';
  private static readonly TENANT_PREFIX = 'gmao'; // Structure: gmao/{tenant_id}/*
  
  /**
   * Upload d'un fichier avec compartimentage par tenant
   */
  static async uploadTenantFile(
    tenantId: string,
    file: {
      buffer: Buffer;
      originalName: string;
      mimeType: string;
      size: number;
    },
    fileType: TenantFileType,
    uploadedBy: string,
    accessLevel: 'private' | 'tenant' | 'public' = 'tenant'
  ): Promise<TenantFileMetadata> {
    try {
      // Validation tenant
      await this.validateTenantAccess(tenantId);
      
      // Génération clé S3 avec structure compartimentée
      const s3Key = this.generateTenantS3Key(tenantId, fileType, file.originalName);
      
      // Vérifier les quotas de stockage
      await this.checkStorageQuota(tenantId, file.size);
      
      // Upload vers S3/MinIO
      const uploadCommand = new PutObjectCommand({
        Bucket: this.BASE_BUCKET,
        Key: s3Key,
        Body: file.buffer,
        ContentType: file.mimeType,
        Metadata: {
          'tenant-id': tenantId,
          'file-type': fileType,
          'uploaded-by': uploadedBy,
          'access-level': accessLevel,
          'uploaded-at': new Date().toISOString(),
        },
        // Définir les ACLs selon le niveau d'accès
        ...(accessLevel === 'public' ? { ACL: 'public-read' } : { ACL: 'private' })
      });
      
      const uploadResult = await s3Client.send(uploadCommand);
      
      // Créer métadonnées en base
      const fileMetadata: TenantFileMetadata = {
        tenantId,
        fileType,
        fileName: file.originalName,
        fileSize: file.size,
        contentType: file.mimeType,
        uploadedBy,
        uploadedAt: new Date(),
        s3Key,
        bucket: this.BASE_BUCKET,
        encrypted: !!process.env.KMS_MASTER_KEY,
        accessLevel
      };
      
      // Stocker métadonnées dans PostgreSQL avec RLS
      await this.storeFileMetadata(fileMetadata);
      
      // Audit log
      await this.logFileActivity(tenantId, 'UPLOAD', s3Key, uploadedBy);
      
      console.log(`📁 File uploaded for tenant ${tenantId}: ${s3Key}`);
      
      return fileMetadata;
      
    } catch (error) {
      console.error(`S3 upload failed for tenant ${tenantId}:`, error);
      throw new Error(`File upload failed: ${error.message}`);
    }
  }
  
  /**
   * Téléchargement de fichier avec vérification d'accès tenant
   */
  static async downloadTenantFile(
    tenantId: string,
    s3Key: string,
    requestedBy: string
  ): Promise<{
    stream: any;
    metadata: TenantFileMetadata;
  }> {
    try {
      // Vérifier que le fichier appartient au tenant
      const fileMetadata = await this.getFileMetadata(s3Key);
      
      if (!fileMetadata || fileMetadata.tenantId !== tenantId) {
        throw new Error(`Access denied: file does not belong to tenant ${tenantId}`);
      }
      
      // Vérification des permissions d'accès
      await this.validateFileAccess(tenantId, fileMetadata, requestedBy);
      
      // Téléchargement depuis S3
      const downloadCommand = new GetObjectCommand({
        Bucket: this.BASE_BUCKET,
        Key: s3Key,
      });
      
      const response = await s3Client.send(downloadCommand);
      
      // Audit log
      await this.logFileActivity(tenantId, 'DOWNLOAD', s3Key, requestedBy);
      
      return {
        stream: response.Body,
        metadata: fileMetadata
      };
      
    } catch (error) {
      console.error(`S3 download failed:`, error);
      throw new Error(`File download failed: ${error.message}`);
    }
  }
  
  /**
   * Génération d'URL signée pour accès temporaire
   */
  static async generatePresignedUrl(
    tenantId: string,
    s3Key: string,
    action: 'GET' | 'PUT',
    expiresIn: number = 3600 // 1 heure par défaut
  ): Promise<string> {
    try {
      // Validation tenant
      if (action === 'GET') {
        const fileMetadata = await this.getFileMetadata(s3Key);
        if (!fileMetadata || fileMetadata.tenantId !== tenantId) {
          throw new Error('Access denied to file');
        }
      }
      
      const command = action === 'GET' 
        ? new GetObjectCommand({ Bucket: this.BASE_BUCKET, Key: s3Key })
        : new PutObjectCommand({ 
            Bucket: this.BASE_BUCKET, 
            Key: s3Key,
            Metadata: { 'tenant-id': tenantId }
          });
      
      const signedUrl = await getSignedUrl(s3Client, command, { expiresIn });
      
      // Audit log pour URLs signées
      await this.logFileActivity(tenantId, `PRESIGNED_${action}`, s3Key, 'system');
      
      return signedUrl;
      
    } catch (error) {
      console.error('Failed to generate presigned URL:', error);
      throw new Error('URL generation failed');
    }
  }
  
  /**
   * Suppression de fichier avec validation tenant
   */
  static async deleteTenantFile(
    tenantId: string,
    s3Key: string,
    deletedBy: string
  ): Promise<void> {
    try {
      // Vérifier propriété du fichier
      const fileMetadata = await this.getFileMetadata(s3Key);
      
      if (!fileMetadata || fileMetadata.tenantId !== tenantId) {
        throw new Error(`Cannot delete file: not owned by tenant ${tenantId}`);
      }
      
      // Suppression S3
      const deleteCommand = new DeleteObjectCommand({
        Bucket: this.BASE_BUCKET,
        Key: s3Key,
      });
      
      await s3Client.send(deleteCommand);
      
      // Suppression métadonnées
      await this.deleteFileMetadata(s3Key);
      
      // Audit log
      await this.logFileActivity(tenantId, 'DELETE', s3Key, deletedBy);
      
      console.log(`🗑️ File deleted for tenant ${tenantId}: ${s3Key}`);
      
    } catch (error) {
      console.error('S3 file deletion failed:', error);
      throw new Error(`File deletion failed: ${error.message}`);
    }
  }
  
  /**
   * Lister les fichiers d'un tenant
   */
  static async listTenantFiles(
    tenantId: string,
    fileType?: TenantFileType,
    limit: number = 100
  ): Promise<TenantFileMetadata[]> {
    try {
      await this.validateTenantAccess(tenantId);
      
      let query = sql`
        SELECT * FROM tenant_files 
        WHERE tenant_id = ${tenantId}
      `;
      
      if (fileType) {
        query = sql`
          SELECT * FROM tenant_files 
          WHERE tenant_id = ${tenantId} AND file_type = ${fileType}
        `;
      }
      
      query = sql`${query} ORDER BY uploaded_at DESC LIMIT ${limit}`;
      
      const results = await db.execute(query);
      
      return results.map(this.mapDbResultToMetadata);
      
    } catch (error) {
      console.error('Failed to list tenant files:', error);
      throw new Error('File listing failed');
    }
  }
  
  /**
   * Calcul de l'usage de stockage par tenant
   */
  static async getTenantStorageUsage(tenantId: string): Promise<{
    totalFiles: number;
    totalSizeBytes: number;
    usageByType: Record<TenantFileType, { files: number; sizeBytes: number }>;
    quotaBytes: number;
    percentageUsed: number;
  }> {
    try {
      const [totalStats] = await db.execute(sql`
        SELECT 
          COUNT(*) as total_files,
          SUM(file_size) as total_size
        FROM tenant_files 
        WHERE tenant_id = ${tenantId}
      `);
      
      const typeStats = await db.execute(sql`
        SELECT 
          file_type,
          COUNT(*) as files,
          SUM(file_size) as size_bytes
        FROM tenant_files 
        WHERE tenant_id = ${tenantId}
        GROUP BY file_type
      `);
      
      // Récupérer quota tenant
      const quotaBytes = await this.getTenantStorageQuota(tenantId);
      
      const usageByType: Record<string, { files: number; sizeBytes: number }> = {};
      for (const stat of typeStats) {
        const s = stat as any;
        usageByType[s.file_type] = {
          files: parseInt(s.files),
          sizeBytes: parseInt(s.size_bytes) || 0
        };
      }
      
      const totalSizeBytes = parseInt((totalStats as any).total_size) || 0;
      const percentageUsed = quotaBytes > 0 ? (totalSizeBytes / quotaBytes) * 100 : 0;
      
      return {
        totalFiles: parseInt((totalStats as any).total_files) || 0,
        totalSizeBytes,
        usageByType: usageByType as Record<TenantFileType, { files: number; sizeBytes: number }>,
        quotaBytes,
        percentageUsed: Math.round(percentageUsed * 100) / 100
      };
      
    } catch (error) {
      console.error('Failed to calculate storage usage:', error);
      throw new Error('Storage calculation failed');
    }
  }
  
  /**
   * Suppression complète des fichiers d'un tenant (GDPR)
   */
  static async deleteTenantAllFiles(tenantId: string, deletedBy: string = 'system'): Promise<{
    deletedFiles: number;
    freedSpaceBytes: number;
  }> {
    try {
      // Récupérer tous les fichiers du tenant
      const tenantFiles = await this.listTenantFiles(tenantId, undefined, 10000);
      
      let deletedFiles = 0;
      let freedSpaceBytes = 0;
      
      // Suppression S3 et métadonnées
      for (const file of tenantFiles) {
        try {
          await this.deleteTenantFile(tenantId, file.s3Key, deletedBy);
          deletedFiles++;
          freedSpaceBytes += file.fileSize;
        } catch (error) {
          console.warn(`Failed to delete file ${file.s3Key}:`, error);
        }
      }
      
      // Audit log pour suppression massive
      await this.logFileActivity(tenantId, 'BULK_DELETE', `${deletedFiles}_files`, deletedBy);
      
      console.log(`🗑️ Bulk deletion for tenant ${tenantId}: ${deletedFiles} files, ${freedSpaceBytes} bytes freed`);
      
      return { deletedFiles, freedSpaceBytes };
      
    } catch (error) {
      console.error('Bulk file deletion failed:', error);
      throw new Error('Bulk deletion failed');
    }
  }
  
  // ============================
  // MÉTHODES PRIVÉES
  // ============================
  
  /**
   * Générer clé S3 avec structure tenant
   */
  private static generateTenantS3Key(
    tenantId: string, 
    fileType: TenantFileType, 
    fileName: string
  ): string {
    const sanitizedFileName = fileName.replace(/[^a-zA-Z0-9.-]/g, '_');
    const timestamp = Date.now();
    const uniqueId = Math.random().toString(36).substring(2, 8);
    
    return `${this.TENANT_PREFIX}/${tenantId}/${fileType}/${timestamp}-${uniqueId}-${sanitizedFileName}`;
  }
  
  /**
   * Valider l'accès tenant
   */
  private static async validateTenantAccess(tenantId: string): Promise<void> {
    const currentTenant = await this.getCurrentTenant();
    if (currentTenant !== tenantId) {
      throw new Error(`Access denied: current tenant ${currentTenant} cannot access ${tenantId} files`);
    }
  }
  
  /**
   * Obtenir tenant actuel
   */
  private static async getCurrentTenant(): Promise<string> {
    const [result] = await db.execute(sql`SELECT get_current_tenant() as tenant_id`);
    return (result as any)?.tenant_id || '';
  }
  
  /**
   * Vérifier quota de stockage
   */
  private static async checkStorageQuota(tenantId: string, additionalSize: number): Promise<void> {
    const usage = await this.getTenantStorageUsage(tenantId);
    
    if (usage.totalSizeBytes + additionalSize > usage.quotaBytes) {
      throw new Error(`Storage quota exceeded: ${usage.percentageUsed}% used`);
    }
  }
  
  /**
   * Obtenir quota de stockage du tenant
   */
  private static async getTenantStorageQuota(tenantId: string): Promise<number> {
    const [tenant] = await db.execute(sql`
      SELECT storage_quota_bytes FROM tenants WHERE id = ${tenantId}
    `);
    
    return (tenant as any)?.storage_quota_bytes || (5 * 1024 * 1024 * 1024); // 5GB par défaut
  }
  
  /**
   * Stocker métadonnées de fichier
   */
  private static async storeFileMetadata(metadata: TenantFileMetadata): Promise<void> {
    await db.execute(sql`
      INSERT INTO tenant_files (
        tenant_id, file_type, file_name, file_size, content_type, 
        uploaded_by, uploaded_at, s3_key, bucket, encrypted, access_level
      ) VALUES (
        ${metadata.tenantId}, ${metadata.fileType}, ${metadata.fileName},
        ${metadata.fileSize}, ${metadata.contentType}, ${metadata.uploadedBy},
        ${metadata.uploadedAt}, ${metadata.s3Key}, ${metadata.bucket},
        ${metadata.encrypted}, ${metadata.accessLevel}
      )
    `);
  }
  
  /**
   * Récupérer métadonnées de fichier
   */
  private static async getFileMetadata(s3Key: string): Promise<TenantFileMetadata | null> {
    const [result] = await db.execute(sql`
      SELECT * FROM tenant_files WHERE s3_key = ${s3Key}
    `);
    
    if (!result) return null;
    
    return this.mapDbResultToMetadata(result);
  }
  
  /**
   * Supprimer métadonnées de fichier
   */
  private static async deleteFileMetadata(s3Key: string): Promise<void> {
    await db.execute(sql`
      DELETE FROM tenant_files WHERE s3_key = ${s3Key}
    `);
  }
  
  /**
   * Valider accès à un fichier
   */
  private static async validateFileAccess(
    tenantId: string, 
    fileMetadata: TenantFileMetadata, 
    requestedBy: string
  ): Promise<void> {
    // Vérifications d'accès selon le niveau
    switch (fileMetadata.accessLevel) {
      case 'private':
        if (fileMetadata.uploadedBy !== requestedBy) {
          throw new Error('Access denied: private file');
        }
        break;
      case 'tenant':
        // Accès OK si même tenant (déjà vérifié)
        break;
      case 'public':
        // Accès libre
        break;
    }
  }
  
  /**
   * Mapper résultat DB vers métadonnées
   */
  private static mapDbResultToMetadata(dbResult: any): TenantFileMetadata {
    return {
      tenantId: dbResult.tenant_id,
      fileType: dbResult.file_type,
      fileName: dbResult.file_name,
      fileSize: dbResult.file_size,
      contentType: dbResult.content_type,
      uploadedBy: dbResult.uploaded_by,
      uploadedAt: dbResult.uploaded_at,
      s3Key: dbResult.s3_key,
      bucket: dbResult.bucket,
      encrypted: dbResult.encrypted,
      accessLevel: dbResult.access_level
    };
  }
  
  /**
   * Logger activité fichier
   */
  private static async logFileActivity(
    tenantId: string, 
    action: string, 
    s3Key: string, 
    performedBy: string
  ): Promise<void> {
    try {
      await db.execute(sql`
        INSERT INTO audit_logs (tenant_id, action, resource_type, resource_id, user_id, success, details, timestamp)
        VALUES (
          ${tenantId}, ${action}, 'file', ${s3Key}, ${performedBy}, true, 
          ${JSON.stringify({ bucket: this.BASE_BUCKET, action })}, NOW()
        )
      `);
    } catch (error) {
      console.error('Failed to log file activity:', error);
    }
  }
}