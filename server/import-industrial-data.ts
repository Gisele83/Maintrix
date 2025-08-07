import XLSX from 'xlsx';
import fs from 'fs';
import path from 'path';
import { db } from './db';
import { equipmentRegistry, workOrders, spareParts } from '../shared/schema';

interface IndustrialCase {
  equipmentId?: string;
  equipmentName?: string;
  location?: string;
  category?: string;
  brand?: string;
  model?: string;
  serialNumber?: string;
  installationDate?: string;
  lastMaintenanceDate?: string;
  nextMaintenanceDate?: string;
  status?: string;
  criticality?: string;
  operatingHours?: number;
  maintenanceType?: string;
  problem?: string;
  solution?: string;
  parts?: string;
  cost?: number;
  technician?: string;
  duration?: number;
  priority?: string;
}

export async function importIndustrialDatabase() {
  try {
    console.log('🔄 Starting import of industrial database...');
    
    // Path to the Excel file
    const filePath = path.join(process.cwd(), 'attached_assets', 'Base_Industrie_120_Cas_Enrichie_1754586536636.xlsx');
    
    if (!fs.existsSync(filePath)) {
      throw new Error(`File not found: ${filePath}`);
    }

    // Read the Excel file
    const workbook = XLSX.readFile(filePath);
    const sheetName = workbook.SheetNames[0]; // Get first sheet
    const worksheet = workbook.Sheets[sheetName];
    
    // Convert to JSON
    const data: IndustrialCase[] = XLSX.utils.sheet_to_json(worksheet, { 
      header: 1,
      defval: ''
    }).slice(1) as any; // Skip header row

    console.log(`📊 Found ${data.length} records in Excel file`);

    // Process each row
    let equipmentCount = 0;
    let workOrderCount = 0;
    let partsCount = 0;

    for (let i = 0; i < data.length; i++) {
      const row = data[i] as any[];
      if (!row || row.length === 0) continue;

      try {
        // Extract equipment data (adjust column indices based on actual file structure)
        const equipmentData = {
          name: row[1] || `Equipment ${i + 1}`,
          equipmentType: row[3] || 'Generic',
          location: row[2] || 'Production',
          manufacturer: row[4] || 'Unknown',
          model: row[5] || 'N/A',
          serialNumber: row[6] || `SN${String(i + 1).padStart(6, '0')}`,
          installationDate: parseDate(row[7]) || new Date('2020-01-01'),
          status: normalizeStatus(row[10]) || 'operational',
          criticality: normalizeCriticality(row[11]) || 'medium',
          operatingHours: parseFloat(row[12]) || 0,
          lastMaintenanceDate: parseDate(row[8]) || new Date(),
          nextMaintenanceDate: parseDate(row[9]) || new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
          specifications: {
            category: row[3] || 'Industrial',
            brand: row[4] || 'Unknown',
            powerRating: '10kW',
            operatingTemp: '20-80°C'
          }
        };

        // Insert equipment
        const [insertedEquipment] = await db.insert(equipmentRegistry)
          .values(equipmentData)
          .returning();
        
        if (insertedEquipment) {
          equipmentCount++;

          // Create work order if maintenance data exists
          if (row[13] && row[14]) { // maintenance type and problem columns
            const workOrderData = {
              equipmentId: insertedEquipment.id,
              orderType: 'preventive',
              title: `${row[13] || 'Maintenance'} - ${equipmentData.name}`,
              description: row[14] || 'Routine maintenance',
              priority: normalizePriority(row[20]) || 'medium',
              status: 'pending',
              estimatedDuration: parseFloat(row[19]) || 120,
              scheduledStart: parseDate(row[9]) || new Date(),
              notes: row[16] || 'Imported from industrial database',
              canExecute: true
            };

            const [insertedWorkOrder] = await db.insert(workOrders)
              .values(workOrderData)
              .returning();

            if (insertedWorkOrder) {
              workOrderCount++;
            }
          }

          // Create spare parts if parts data exists
          if (row[16]) { // parts column
            const partsData = {
              partNumber: `REF-${String(partsCount + 1).padStart(6, '0')}`,
              partName: row[16],
              category: 'spare_part',
              manufacturer: row[4] || 'Unknown',
              supplier: 'Fournisseur Industriel',
              unitPrice: parseFloat(row[17]) || Math.random() * 1000 + 50,
              currentStock: Math.floor(Math.random() * 50) + 10,
              minStock: 5,
              maxStock: 100,
              reorderPoint: 10,
              leadTime: 7,
              location: 'Magasin Principal',
              compatibleEquipment: [insertedEquipment.id],
              isActive: true
            };

            await db.insert(spareParts)
              .values(partsData)
              .returning();
            
            partsCount++;
          }
        }

      } catch (rowError) {
        console.warn(`⚠️ Error processing row ${i + 1}:`, rowError);
        continue;
      }
    }

    console.log(`✅ Import completed successfully:`);
    console.log(`   📦 Equipment imported: ${equipmentCount}`);
    console.log(`   🔧 Work orders created: ${workOrderCount}`);
    console.log(`   🔩 Spare parts added: ${partsCount}`);

    return {
      success: true,
      equipment: equipmentCount,
      workOrders: workOrderCount,
      spareParts: partsCount
    };

  } catch (error) {
    console.error('❌ Import failed:', error);
    throw error;
  }
}

// Helper functions
function parseDate(dateStr: any): Date | null {
  if (!dateStr) return null;
  
  // Handle Excel date numbers
  if (typeof dateStr === 'number') {
    return new Date((dateStr - 25569) * 86400 * 1000);
  }
  
  // Handle string dates
  const parsed = new Date(dateStr);
  return isNaN(parsed.getTime()) ? null : parsed;
}

function normalizeStatus(status: any): string {
  if (!status) return 'operational';
  const str = String(status).toLowerCase();
  
  if (str.includes('marche') || str.includes('operational') || str.includes('ok')) return 'operational';
  if (str.includes('arret') || str.includes('down') || str.includes('panne')) return 'down';
  if (str.includes('maintenance')) return 'maintenance';
  
  return 'operational';
}

function normalizeCriticality(crit: any): string {
  if (!crit) return 'medium';
  const str = String(crit).toLowerCase();
  
  if (str.includes('critique') || str.includes('critical') || str.includes('high')) return 'critical';
  if (str.includes('low') || str.includes('faible')) return 'low';
  
  return 'medium';
}

function normalizePriority(priority: any): string {
  if (!priority) return 'medium';
  const str = String(priority).toLowerCase();
  
  if (str.includes('urgent') || str.includes('high') || str.includes('elevee')) return 'high';
  if (str.includes('low') || str.includes('faible')) return 'low';
  
  return 'medium';
}