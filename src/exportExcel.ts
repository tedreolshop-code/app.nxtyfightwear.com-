// Export data ke file Excel (.xlsx) dengan format rapi: header berwarna,
// lebar kolom otomatis, format rupiah, dan freeze baris header.
// exceljs dimuat lazy supaya bundle utama aplikasi tetap ringan.
import { dataStore } from './dataStore';

export interface ExcelSheet {
  name: string;
  rows: Record<string, string | number | boolean | undefined | null>[];
  /** Nama kolom yang diformat sebagai rupiah (Rp #.##0) */
  currencyColumns?: string[];
}

const sanitizeSheetName = (name: string) => name.replace(/[\\/*?:[\]]/g, ' ').slice(0, 31) || 'Data';

const headerLabel = (key: string) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, char => char.toUpperCase());

export const exportExcel = async (filename: string, sheets: ExcelSheet[]) => {
  const filled = sheets.filter(sheet => sheet.rows.length > 0);
  if (!filled.length) {
    alert('Tidak ada data untuk diekspor pada periode ini.');
    return;
  }

  const ExcelJS = (await import('exceljs')).default;
  const workbook = new ExcelJS.Workbook();
  workbook.creator = dataStore.getBrandSettings?.()?.company_name || 'Aplikasi';
  workbook.created = new Date();

  const brandHex = (dataStore.getBrandSettings?.()?.primary_color || '#1F4B36').replace('#', '').toUpperCase();

  for (const sheet of filled) {
    const worksheet = workbook.addWorksheet(sanitizeSheetName(sheet.name), {
      views: [{ state: 'frozen', ySplit: 1 }],
    });
    const keys = Object.keys(sheet.rows[0]);
    const currencySet = new Set(sheet.currencyColumns || []);

    worksheet.columns = keys.map(key => ({
      key,
      header: headerLabel(key),
      width: Math.min(40, Math.max(
        headerLabel(key).length + 4,
        ...sheet.rows.slice(0, 200).map(row => String(row[key] ?? '').length + 2)
      )),
      style: currencySet.has(key) ? { numFmt: '"Rp" #,##0' } : undefined,
    }));

    const headerRow = worksheet.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' }, size: 11 };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: `FF${brandHex}` } };
    headerRow.alignment = { vertical: 'middle' };
    headerRow.height = 22;

    for (const row of sheet.rows) {
      worksheet.addRow(keys.map(key => {
        const value = row[key];
        if (currencySet.has(key)) return Number(value) || 0;
        return value ?? '';
      }));
    }

    worksheet.autoFilter = { from: { row: 1, column: 1 }, to: { row: 1, column: keys.length } };
  }

  const buffer = await workbook.xlsx.writeBuffer();
  const blob = new Blob([buffer], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = `${filename}_${new Date().toISOString().split('T')[0]}.xlsx`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(link.href);
};
