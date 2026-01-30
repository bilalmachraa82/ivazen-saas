/**
 * Detailed structure analysis of Adélia's files
 * Focus on: Complete columns, monetary values, and Declaração format
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
console.log('ANÁLISE DETALHADA - ESTRUTURA COMPLETA');
console.log('='.repeat(80));

// 1. Detailed analysis of ListaRecibos.xls - ALL COLUMNS
console.log('\n\n📋 ListaRecibos.xls - TODAS AS COLUNAS');
console.log('-'.repeat(60));

const recibosPath = path.join(__dirname, '..', 'ListaRecibos.xls');
const recibosWB = readExcel(recibosPath);
const recibosSheet = recibosWB.Sheets['Recibos locatario'];
const recibosData = XLSX.utils.sheet_to_json(recibosSheet, { header: 1, defval: '' });

console.log('\n📊 HEADER COMPLETO (todas as colunas):');
const headers = recibosData[0];
headers.forEach((h, i) => {
  const colLetter = XLSX.utils.encode_col(i);
  console.log(`   ${colLetter}: "${h}"`);
});

console.log('\n📊 PRIMEIRA LINHA DE DADOS (todas as colunas):');
const firstRow = recibosData[1];
firstRow.forEach((v, i) => {
  const colLetter = XLSX.utils.encode_col(i);
  const header = headers[i] || `Col ${i}`;
  if (v !== '') {
    console.log(`   ${colLetter} (${header}): ${JSON.stringify(v)}`);
  }
});

// Check range
console.log('\n📊 RANGE DO SHEET:', recibosSheet['!ref']);

// Check for numeric values (potential amounts)
console.log('\n📊 PROCURANDO VALORES NUMÉRICOS (montantes):');
Object.keys(recibosSheet).forEach(cell => {
  if (!cell.startsWith('!') && recibosSheet[cell].t === 'n') {
    console.log(`   ${cell}: ${recibosSheet[cell].v} (number)`);
  }
});

// 2. Detailed analysis of ListaRecibos_1.xls
console.log('\n\n' + '='.repeat(80));
console.log('📋 ListaRecibos_1.xls - ESTRUTURA');
console.log('='.repeat(80));

const recibos1Path = path.join(__dirname, '..', 'ListaRecibos_1.xls');
const recibos1WB = readExcel(recibos1Path);

recibos1WB.SheetNames.forEach(sheetName => {
  console.log(`\n📊 ABA: "${sheetName}"`);
  const ws = recibos1WB.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(ws, { header: 1, defval: '' });

  console.log('   Headers:', JSON.stringify(data[0]));
  console.log('   Primeira linha:', JSON.stringify(data[1]?.slice(0, 10)));
  console.log('   Total linhas:', data.length);

  // Check for NIFs
  data.forEach((row, i) => {
    row.forEach((cell, j) => {
      const cellStr = String(cell);
      if (/^\d{9}$/.test(cellStr)) {
        console.log(`   NIF encontrado em linha ${i+1}, col ${j}: ${cellStr}`);
      }
    });
  });
});

// 3. Detailed Declaração sheet analysis with all rows
console.log('\n\n' + '='.repeat(80));
console.log('📋 DECLARAÇÃO SHEET - ESTRUTURA COMPLETA');
console.log('='.repeat(80));

const templatePath = path.join(__dirname, '..', 'EXEMPLO_ DR Independentes.xlsx');
const templateWB = readExcel(templatePath);

// Use "Declaração rendimentos MartaCar" as example (sheet 3)
const declSheet = templateWB.Sheets['Declaração rendimentos MartaCar'];
const declData = XLSX.utils.sheet_to_json(declSheet, { header: 1, defval: '' });

console.log('\n📊 TODAS AS LINHAS COM CONTEÚDO:');
declData.forEach((row, i) => {
  const nonEmpty = row.filter(c => c !== '' && c !== ' ');
  if (nonEmpty.length > 0) {
    console.log(`   Linha ${String(i + 1).padStart(2)}: ${JSON.stringify(nonEmpty.slice(0, 6))}`);
  }
});

// Look for specific cells with values
console.log('\n📊 CÉLULAS COM VALORES NUMÉRICOS (montantes):');
Object.keys(declSheet).forEach(cell => {
  if (!cell.startsWith('!')) {
    const cellVal = declSheet[cell];
    if (cellVal.t === 'n' && cellVal.v !== 0) {
      console.log(`   ${cell}: ${cellVal.v} (${typeof cellVal.v})`);
    }
  }
});

// Check specific cells where values should be
console.log('\n📊 PROCURANDO LABELS "RENDIMENTO", "RETENÇÃO", etc:');
Object.keys(declSheet).forEach(cell => {
  if (!cell.startsWith('!')) {
    const val = String(declSheet[cell].v || '').toLowerCase();
    if (val.includes('rendimento') || val.includes('retençã') || val.includes('imposto') ||
        val.includes('bruto') || val.includes('retido') || val.includes('ano')) {
      console.log(`   ${cell}: "${declSheet[cell].v}"`);
    }
  }
});

// Get merged cells
console.log('\n📊 MERGED CELLS (principais):');
if (declSheet['!merges']) {
  declSheet['!merges'].forEach(m => {
    const range = XLSX.utils.encode_range(m);
    console.log(`   ${range}`);
  });
}

// 4. Check Prediais sheet structure (might have values)
console.log('\n\n' + '='.repeat(80));
console.log('📋 PREDIAIS SHEET (RENDAS) - ESTRUTURA');
console.log('='.repeat(80));

const prediaisSheet = templateWB.Sheets['Prediais Olivier'];
const prediaisData = XLSX.utils.sheet_to_json(prediaisSheet, { header: 1, defval: '' });

console.log('\n📊 LINHAS COM CONTEÚDO:');
prediaisData.forEach((row, i) => {
  const nonEmpty = row.filter(c => c !== '' && c !== ' ');
  if (nonEmpty.length > 0 && i < 50) {
    console.log(`   Linha ${String(i + 1).padStart(2)}: ${JSON.stringify(nonEmpty.slice(0, 6))}`);
  }
});

console.log('\n📊 VALORES NUMÉRICOS:');
Object.keys(prediaisSheet).forEach(cell => {
  if (!cell.startsWith('!') && prediaisSheet[cell].t === 'n' && prediaisSheet[cell].v !== 0) {
    console.log(`   ${cell}: ${prediaisSheet[cell].v}`);
  }
});

// 5. Summary
console.log('\n\n' + '='.repeat(80));
console.log('📊 RESUMO DOS ACHADOS');
console.log('='.repeat(80));

console.log(`
FICHEIROS ANALISADOS:
- ListaRecibos.xls: ${recibosData.length - 1} registos (formato "Recibos locatario")
- EXEMPLO_DR: ${templateWB.SheetNames.length} abas (2 Prediais + ${templateWB.SheetNames.length - 2} Declarações)

FORMATO ListaRecibos.xls:
- Colunas: ${headers.join(', ')}
- ATENÇÃO: Este é formato de RENDAS (arrendamento), não Recibos Verdes!
- Não tem colunas NIF ou Valor como esperado

FORMATO DECLARAÇÃO:
- Linha 1: "DECLARAÇÃO DE IRS"
- Linha 2: "(Alinea b do Nº1 do Art. 119 do CIRS e Art. 128 do CIRC)"
- Linha 4-6: Dados empresa emissora
- Linha 12-14: Dados do prestador
- Linha 18: Data
- Linhas seguintes: Quadros com valores (Categoria, Ano, NIF, Rendimentos, Retenção)
`);
