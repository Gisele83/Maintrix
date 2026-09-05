import PDFDocument from 'pdfkit';

interface PurchaseOrderData {
  id: number;
  orderNumber: string;
  orderType: string;
  description: string;
  supplier: string;
  items: Array<{
    partNumber: string;
    description: string;
    quantity: number;
    unitPrice: number;
  }>;
  totalAmount: string;
  currency: string;
  validationStatus: string;
  priority: string;
  requestedBy: string;
  deliveryDate?: Date;
  createdAt?: Date;
}

interface CompanyConfig {
  companyName: string;
  address: string;
  phone: string;
  email: string;
  website: string;
  taxNumber: string;
  logoBase64?: string;
  primaryColor?: string;
}

export function generatePurchaseOrderPDF(orderData: PurchaseOrderData, companyConfig?: CompanyConfig): InstanceType<typeof PDFDocument> {
  const doc = new PDFDocument({ size: 'A4', margin: 50 });
  
  // Colors
  const primaryColor = companyConfig?.primaryColor || '#0066cc';
  const textColor = '#333333';
  const headerColor = '#666666';

  // Header with company info
  if (companyConfig) {
    doc.fontSize(20)
       .fillColor(primaryColor)
       .text(companyConfig.companyName, 50, 50);
    
    doc.fontSize(10)
       .fillColor(headerColor)
       .text(companyConfig.address.replace(/\n/g, ', '), 50, 80)
       .text(`Tél: ${companyConfig.phone} | Email: ${companyConfig.email}`, 50, 95)
       .text(`Web: ${companyConfig.website} | SIRET: ${companyConfig.taxNumber}`, 50, 110);
  }

  // Horizontal line
  doc.moveTo(50, 135)
     .lineTo(550, 135)
     .strokeColor(primaryColor)
     .lineWidth(2)
     .stroke();

  // Document title
  doc.fontSize(18)
     .fillColor(primaryColor)
     .text('BON DE COMMANDE', 50, 160);

  // Order info
  const orderInfoY = 200;
  doc.fontSize(11)
     .fillColor(textColor)
     .text(`Numéro: ${orderData.orderNumber}`, 50, orderInfoY)
     .text(`Type: ${orderData.orderType}`, 50, orderInfoY + 15)
     .text(`Date: ${new Date().toLocaleDateString('fr-FR')}`, 50, orderInfoY + 30)
     .text(`Demandeur: ${orderData.requestedBy}`, 50, orderInfoY + 45);

  // Supplier info (right side)
  doc.text(`Fournisseur:`, 350, orderInfoY)
     .text(orderData.supplier, 350, orderInfoY + 15)
     .text(`Statut: ${orderData.validationStatus}`, 350, orderInfoY + 45)
     .text(`Priorité: ${orderData.priority}`, 350, orderInfoY + 60);

  // Description
  if (orderData.description) {
    doc.fontSize(10)
       .fillColor(headerColor)
       .text(`Description: ${orderData.description}`, 50, orderInfoY + 80, { width: 500 });
  }

  // Items table
  const tableTop = 320;
  const itemCodeX = 50;
  const descriptionX = 120;
  const quantityX = 320;
  const priceX = 380;
  const totalX = 480;

  // Table header
  doc.fontSize(10)
     .fillColor('white')
     .rect(50, tableTop, 500, 25)
     .fillAndStroke(primaryColor, primaryColor);

  doc.fillColor('white')
     .text('Référence', itemCodeX + 5, tableTop + 8)
     .text('Description', descriptionX + 5, tableTop + 8)
     .text('Qté', quantityX + 5, tableTop + 8)
     .text('Prix Unit.', priceX + 5, tableTop + 8)
     .text('Total', totalX + 5, tableTop + 8);

  // Table rows
  let currentY = tableTop + 25;
  let totalHT = 0;

  orderData.items.forEach((item, index) => {
    const itemTotal = item.quantity * item.unitPrice;
    totalHT += itemTotal;
    
    const bgColor = index % 2 === 0 ? '#f8f9fa' : '#ffffff';
    
    doc.rect(50, currentY, 500, 25)
       .fillColor(bgColor)
       .fill();

    doc.fontSize(9)
       .fillColor(textColor)
       .text(item.partNumber, itemCodeX + 5, currentY + 8, { width: 65 })
       .text(item.description, descriptionX + 5, currentY + 8, { width: 195 })
       .text(item.quantity.toString(), quantityX + 5, currentY + 8, { align: 'center' })
       .text(`${item.unitPrice.toFixed(2)} €`, priceX + 5, currentY + 8, { align: 'right', width: 95 })
       .text(`${itemTotal.toFixed(2)} €`, totalX + 5, currentY + 8, { align: 'right', width: 65 });
    
    currentY += 25;
  });

  // Total row
  doc.rect(50, currentY, 500, 25)
     .fillColor('#e9ecef')
     .fill();

  doc.fontSize(11)
     .fillColor(textColor)
     .text('TOTAL HT:', 400, currentY + 8, { align: 'right' })
     .text(`${totalHT.toFixed(2)} €`, totalX + 5, currentY + 8, { align: 'right', width: 65 });

  // Footer
  const footerY = currentY + 60;
  doc.fontSize(9)
     .fillColor(headerColor)
     .text('Conditions: Livraison selon délais convenus', 50, footerY)
     .text(`Document généré le ${new Date().toLocaleString('fr-FR')}`, 50, footerY + 15);

  if (companyConfig) {
    doc.text(`${companyConfig.companyName} - ${companyConfig.phone} - ${companyConfig.email}`, 50, footerY + 40);
  }

  return doc;
}