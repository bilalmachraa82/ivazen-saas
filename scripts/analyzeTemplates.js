/**
 * Script to analyze Adélia's Excel templates
 * Compares official EXEMPLO_DR template with our implementation
 */

import * as XLSX from 'xlsx';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function readExcel(filePath) {
  const buffer = fs.readFileSync(filePath);
  return XLSX.read(buffer, { type: 'buffer' });
}

console.log('='.repeat(80));
console.log('ANÁLISE DOS FICHEIROS DA ADÉLIA');
console.log('='.repeat(80));

// 1. Analyze EXEMPLO_DR Template
console.log('\n\n📋 EXEMPLO_DR Independentes.xlsx (TEMPLATE OFICIAL)');
console.log('-'.repeat(60));

const templatePath = path.join(__dirname, '..', 'EXEMPLO_ DR Independentes.xlsx');
const templateWB = readExcel(templatePath);

console.log('\n📑 ABAS ENCONTRADAS:', templateWB.SheetNames.length);
templateWB.SheetNames.forEach((name, i) => {
  console.log(`   ${i + 1}. "${name}"`);
});

// Analyze each sheet
templateWB.SheetNames.forEach(sheetName => {
  console.log('\n' + '='.repeat(60));
  console.log(`📊 ABA: "${sheetName}"`);
  console.log('='.repeat(60));

  const ws = templateWB.Sheets[sheetName];
  const range = XLSX.utils.decode_range(ws['!ref'] || 'A1');
  console.log(`   Range: ${ws['!ref']}`);
  console.log(`   Rows: ${range.e.r + 1}, Cols: ${range.e.c + 1}`);

  // Get merged cells
  if (ws['!merges']) {
    console.log(`   Merged cells: ${ws['!merges'].length}`);
    ws['!merges'].slice(0, 5).forEach(m => {
      console.log(`      - ${XLSX.utils.encode_range(m)}`);
    });
    if (ws['!merges'].length > 5) {
      console.log(`      ... and ${ws['!merges'].length - 5} more`);
    }
  }

  // Show first 20 rows as JSON
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });
  console.log('\n   Primeiras linhas:');
  data.slice(0, 20).forEach((row, i) => {
    const nonEmpty = row.filter(c => c !== '').slice(0, 6);
    if (nonEmpty.length > 0) {
      console.log(`   ${String(i + 1).padStart(3)}: ${JSON.stringify(nonEmpty)}`);
    }
  });
});

// 2. Analyze ListaRecibos.xls (Real Data)
console.log('\n\n' + '='.repeat(80));
console.log('📋 ListaRecibos.xls (DADOS REAIS - RECIBOS VERDES)');
console.log('='.repeat(80));

const recibosPath = path.join(__dirname, '..', 'ListaRecibos.xls');
const recibosWB = readExcel(recibosPath);

console.log('\n📑 ABAS:', recibosWB.SheetNames);

recibosWB.SheetNames.forEach(sheetName => {
  const ws = recibosWB.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`\n📊 ABA: "${sheetName}" - ${data.length} linhas`);

  // Show headers and first data rows
  console.log('\n   Headers e primeiras linhas:');
  data.slice(0, 15).forEach((row, i) => {
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
      console.log(`   ${String(i + 1).padStart(3)}: ${JSON.stringify(nonEmpty.slice(0, 8))}`);
    }
  });

  // Count unique NIFs
  const nifColumn = data.slice(1).map(row => row[0]).filter(v => v && String(v).length === 9);
  const uniqueNIFs = new Set(nifColumn);
  console.log(`\n   📊 Estatísticas:`);
  console.log(`      Total registos: ${data.length - 1}`);
  console.log(`      NIFs únicos: ${uniqueNIFs.size}`);

  // Check for cell styles (yellow highlighting)
  console.log('\n   🎨 Células com estilos (se disponível):');
  const cellsWithStyles = Object.keys(ws).filter(k => !k.startsWith('!') && ws[k].s);
  if (cellsWithStyles.length > 0) {
    console.log(`      ${cellsWithStyles.length} células com formatação`);
  } else {
    console.log('      Nota: Ficheiros .xls antigos podem não preservar estilos');
  }
});

// 3. Analyze ListaRecibos-Renda.xls
console.log('\n\n' + '='.repeat(80));
console.log('📋 ListaRecibos-Renda.xls (DADOS REAIS - RENDAS 28%)');
console.log('='.repeat(80));

const rendaPath = path.join(__dirname, '..', 'ListaRecibos-Renda.xls');
const rendaWB = readExcel(rendaPath);

rendaWB.SheetNames.forEach(sheetName => {
  const ws = rendaWB.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log(`\n📊 ABA: "${sheetName}" - ${data.length} linhas`);

  // Show headers and first data rows
  console.log('\n   Headers e primeiras linhas:');
  data.slice(0, 15).forEach((row, i) => {
    const nonEmpty = row.filter(c => c !== '');
    if (nonEmpty.length > 0) {
      console.log(`   ${String(i + 1).padStart(3)}: ${JSON.stringify(nonEmpty.slice(0, 8))}`);
    }
  });
});

// 4. Compare structure
console.log('\n\n' + '='.repeat(80));
console.log('📊 RESUMO PARA IMPLEMENTAÇÃO');
console.log('='.repeat(80));

console.log('\n✅ ABAS DO TEMPLATE OFICIAL:');
templateWB.SheetNames.forEach((name, i) => {
  console.log(`   ${i + 1}. "${name}"`);
});

console.log('\n📝 NOTAS IMPORTANTES:');
console.log('   - Verificar estrutura exata da aba "Declaração" (se existir)');
console.log('   - Confirmar formatação dos valores monetários');
console.log('   - Identificar merged cells para replicar layout');
console.log('   - Mapear colunas do ListaRecibos para nosso parser');
