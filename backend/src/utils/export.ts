import * as XLSX from 'xlsx';
import { Entry } from '../types';

export function exportToCSV(entries: Entry[]): string {
  const headers = ['日期', '人物', '描述', '金额', '类型'];
  const rows = entries.map(entry => [
    formatDate(entry.date),
    entry.person,
    entry.description || '',
    entry.amount,
    entry.type,
  ]);

  const csvContent = [headers.join(','), ...rows.map(row => row.join(','))].join('\n');
  return '\uFEFF' + csvContent;
}

export function exportToExcel(entries: Entry[]): Buffer {
  const data = entries.map(entry => ({
    日期: formatDate(entry.date),
    人物: entry.person,
    描述: entry.description || '',
    金额: entry.amount,
    类型: entry.type,
  }));

  const worksheet = XLSX.utils.json_to_sheet(data);
  const workbook = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(workbook, worksheet, '账目数据');

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

export function exportByPersonToExcel(entries: Entry[]): Buffer {
  const personGroups: { [key: string]: Entry[] } = {};
  
  for (const entry of entries) {
    if (!personGroups[entry.person]) {
      personGroups[entry.person] = [];
    }
    personGroups[entry.person].push(entry);
  }

  const workbook = XLSX.utils.book_new();

  for (const [person, personEntries] of Object.entries(personGroups)) {
    const data = personEntries.map(entry => ({
      日期: formatDate(entry.date),
      描述: entry.description || '',
      金额: entry.amount,
      类型: entry.type,
    }));

    const worksheet = XLSX.utils.json_to_sheet(data);
    XLSX.utils.book_append_sheet(workbook, worksheet, person.substring(0, 30));
  }

  return XLSX.write(workbook, { type: 'buffer', bookType: 'xlsx' });
}

function formatDate(dateStr: string): string {
  if (dateStr.length === 8 && /^\d+$/.test(dateStr)) {
    return `${dateStr.substring(0, 4)}-${dateStr.substring(4, 6)}-${dateStr.substring(6, 8)}`;
  }
  return dateStr;
}