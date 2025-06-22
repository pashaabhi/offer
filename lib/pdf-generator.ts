import jsPDF from 'jspdf';

export interface StudentData {
  [key: string]: string;
}

export interface FieldMapping {
  [placeholder: string]: string;
}

export function generatePDF(
  templateContent: string,
  studentData: StudentData,
  fieldMapping: FieldMapping,
  fileName: string
): void {
  try {
    // Create new PDF document
    const doc = new jsPDF();
    
    // Replace placeholders with actual data
    let personalizedContent = templateContent;
    
    // Replace mapped fields
    Object.entries(fieldMapping).forEach(([placeholder, excelField]) => {
      const value = studentData[excelField] || `[${placeholder}]`;
      // Use global replace to replace all instances
      personalizedContent = personalizedContent.replace(
        new RegExp(placeholder.replace(/[{}]/g, '\\$&'), 'g'), 
        value
      );
    });
    
    // Replace common date placeholders
    const currentDate = new Date().toLocaleDateString();
    personalizedContent = personalizedContent.replace(/\{\{date\}\}/g, currentDate);
    personalizedContent = personalizedContent.replace(/\{\{today\}\}/g, currentDate);
    
    // Add header with reference number if available
    const refNumber = studentData.Ref_number || studentData.ref_number || 'N/A';
    doc.setFontSize(12);
    doc.text(`Reference: ${refNumber}`, 20, 20);
    doc.text(`Date: ${currentDate}`, 20, 30);
    
    // Add a line separator
    doc.line(20, 35, 190, 35);
    
    // Split content into lines and add to PDF
    const lines = personalizedContent.split('\n');
    let yPosition = 50;
    const pageHeight = doc.internal.pageSize.height;
    const margin = 20;
    const lineHeight = 6;
    
    doc.setFontSize(11);
    
    lines.forEach((line) => {
      // Check if we need a new page
      if (yPosition > pageHeight - margin) {
        doc.addPage();
        yPosition = margin;
      }
      
      // Handle long lines by splitting them
      const maxWidth = 170; // Max width for text
      const splitLines = doc.splitTextToSize(line, maxWidth);
      
      splitLines.forEach((splitLine: string) => {
        if (yPosition > pageHeight - margin) {
          doc.addPage();
          yPosition = margin;
        }
        doc.text(splitLine, margin, yPosition);
        yPosition += lineHeight;
      });
    });
    
    // Add footer
    const pageCount = doc.getNumberOfPages();
    for (let i = 1; i <= pageCount; i++) {
      doc.setPage(i);
      doc.setFontSize(8);
      doc.text(
        `Generated on: ${new Date().toLocaleString()}`,
        margin,
        pageHeight - 10
      );
      doc.text(
        `Page ${i} of ${pageCount}`,
        190 - margin,
        pageHeight - 10,
        { align: 'right' }
      );
    }
    
    // Save the PDF
    doc.save(fileName);
    
  } catch (error) {
    console.error('Error generating PDF:', error);
    throw new Error('Failed to generate PDF. Please try again.');
  }
}

export function generateBulkPDFs(
  templateContent: string,
  studentsData: StudentData[],
  fieldMapping: FieldMapping
): void {
  studentsData.forEach((studentData, index) => {
    const studentName = studentData.name || studentData.Name || `Student_${index + 1}`;
    const refNumber = studentData.Ref_number || studentData.ref_number || `REF${String(index + 1).padStart(3, '0')}`;
    
    // Clean the student name for filename
    const cleanName = studentName.replace(/[^a-zA-Z0-9\s]/g, '').replace(/\s+/g, '_');
    const fileName = `${cleanName}_${refNumber}.pdf`;
    
    try {
      generatePDF(templateContent, studentData, fieldMapping, fileName);
    } catch (error) {
      console.error(`Failed to generate PDF for ${studentName}:`, error);
    }
  });
}