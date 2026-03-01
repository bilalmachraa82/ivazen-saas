#!/usr/bin/env node
/**
 * Re-encrypt AT credentials after Supabase migration
 *
 * Usage:
 *   1. Deploy the reencrypt-credentials edge function first:
 *      supabase functions deploy reencrypt-credentials
 *
 *   2. Run this script:
 *      node scripts/migration/reencrypt-credentials.mjs
 *
 * Environment variables (from .env or inline):
 *   SUPABASE_URL          — new Supabase project URL
 *   SUPABASE_SERVICE_KEY   — new Supabase service role key
 *
 * The script sends the 136 NIF+password pairs to the edge function,
 * which encrypts each with the new key and upserts into at_credentials.
 */

import { readFileSync } from 'fs';
import { resolve, dirname } from 'path';
import { fileURLToPath } from 'url';

// Load .env without external dependency
const __dirname = dirname(fileURLToPath(import.meta.url));
try {
  const envPath = resolve(__dirname, '../../.env');
  const envContent = readFileSync(envPath, 'utf-8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eqIdx = trimmed.indexOf('=');
    if (eqIdx === -1) continue;
    const key = trimmed.slice(0, eqIdx).trim();
    let val = trimmed.slice(eqIdx + 1).trim();
    if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
      val = val.slice(1, -1);
    }
    if (!process.env[key]) process.env[key] = val;
  }
} catch { /* .env not found — rely on exported env vars */ }

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;

// Bilal Machraa — primary accountant in client_accountants table
// UUID from auth.users (bilal.machraa@gmail.com)
const ACCOUNTANT_ID = '5a994a12-8364-4320-ac35-e93f81edcf10';

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_KEY in environment');
  console.error('Set VITE_SUPABASE_URL and SUPABASE_SERVICE_KEY in .env or export them');
  process.exit(1);
}

// ── 136 client records from "Senhas Independentes Bilal.pdf" (05/02/2026) ──

const credentials = [
  { nif: "145285073", password: "CANBO009", name: "Cândida Azevedo Borges" },
  { nif: "179672436", password: "W3VTGP7QXU6F1", name: "Maria Emilia Soares Cardoso Mouta" },
  { nif: "118493035", password: "HERMINIASOUSA17", name: "Herminia da Piedade Madalena Silva de Sousa" },
  { nif: "706583710", password: "MANUEL2018", name: "Manuel V. Pereira Baptista Cabeça Casal Herança" },
  { nif: "137800347", password: "IMPOSTOS1", name: "Maria Emilia da Silva Maia Gomes Aleluia" },
  { nif: "256802378", password: "PNTEP8GNYNNS", name: "Cátia Sofia da Silva Francisco" },
  { nif: "152808299", password: "71A8W4TMBDTZ", name: "Mário Manuel da Silva Carvalhal" },
  { nif: "900425830", password: "YXBETFLQTHGJ", name: "Administração Conjunta da Augi do Bairro dos Pedrogãos" },
  { nif: "265604850", password: "idcra1996", name: "Inês Da Costa Ribeiro Alves" },
  { nif: "306961342", password: "SHCWJDDZCHCJ", name: "Abel Philip Rogers" },
  { nif: "316124427", password: "DYDRJ1ML1D1J", name: "Agata Justyna Marzec" },
  { nif: "247845302", password: "AFKE8ZRZWGK1", name: "Alline Regina Costa De Oliveira" },
  { nif: "203261780", password: "ANACARRICO75", name: "Ana Alexandrina Carriço Fernandes" },
  { nif: "287052940", password: "Cap1950-050", name: "Anna Carolina Lima Pereira" },
  { nif: "228148456", password: "19Alcoutim58", name: "Anabela De Sequeira Raposo Martins Fernandes" },
  { nif: "241873592", password: "RAGSSXLHLVTW", name: "André Fonseca Viana" },
  { nif: "153443480", password: "FiscoPedro02799", name: "António Pedro Rodrigues Costa" },
  { nif: "242172296", password: "NWJMFGIVJQMI", name: "Bárbara Torres Monteiro" },
  { nif: "303003502", password: "Salvejorge", name: "Bruna Rezende da Silva" },
  { nif: "260638684", password: "260638684NADIA", name: "Bruno Miguel da Silva Tavares" },
  { nif: "236652281", password: "374Y5CM3N1XS", name: "Carina Rocha Simões Macedo" },
  { nif: "195595610", password: "Chica2024@#", name: "Carlos Cordeiro" },
  { nif: "294347712", password: "UV6Y1NH7S13J", name: "Carmen Maria Espinosa Laguna" },
  { nif: "313383340", password: "1U4C9G8R3NDV", name: "Cristina Solis Macias" },
  { nif: "257425349", password: "SINCQSYOEGYG", name: "Daniela Grego Duarte" },
  { nif: "288499441", password: "XDWWBRLFILTS", name: "Daniel Anthony Pardo JR" },
  { nif: "211616117", password: "5DXRPM4Y5SUV", name: "David Mendes Duarte" },
  { nif: "217973167", password: "217973167NRM", name: "Nelson Rico de Matos" },
  { nif: "221578510", password: "AR221578510", name: "Andreia Filipa Restolho Dos Santos" },
  { nif: "224334522", password: "TCEALNFDQMFR", name: "Duarte Ramada Leite Anacoreta Caldas" },
  { nif: "260100986", password: "KP86QVGRPKFW", name: "Filipa Pereira Gonçalves" },
  // Page 2
  { nif: "216615100", password: "OSDFQUPH5D11", name: "Filipa Pontes de Moraes" },
  { nif: "259767867", password: "2IQ2023FILIPEPJ", name: "Filipe Rodrigues da Silva Pessoa Jorge" },
  { nif: "146726189", password: "FILOMENA201011", name: "Filomena Maria Cardinal Peixoto Matias" },
  { nif: "258765747", password: "ZXK2BT3C5X87", name: "Gabriela Sequeira Assunção" },
  { nif: "194416534", password: "@Imaginario65", name: "Maria Da Graça Cunha Imaginario Monteiro" },
  { nif: "291689604", password: "HKLKBRBWNJYP", name: "Guilherme Blaia D'Avila" },
  { nif: "186785607", password: "HELENASAAVEDRA", name: "Maria Helena Da Silva Anacleto" },
  { nif: "232091803", password: "leni1107", name: "Helene Konokovi Abiassi" },
  { nif: "216959454", password: "4WD85517F4RH", name: "Hugo Miguel Do Vale Tiago" },
  { nif: "254072992", password: "ALMEIDAJOAO", name: "João Daniel Mourinho Almeida" },
  { nif: "192202472", password: "sportingestrela", name: "João Paulo Soares Ribeiro" },
  { nif: "217338658", password: "ZS3AJ57GJM6K", name: "João Paulo Rocha Da Silva" },
  { nif: "200935380", password: "joaosousa2017", name: "João Luis Silva De Sousa" },
  { nif: "216436958", password: "JosePinto.2025", name: "José Daniel Pinto" },
  { nif: "285558722", password: "biguinha", name: "Juliana De Assis Rodriguez" },
  { nif: "307170730", password: "U4ELXL6GBWUN", name: "Justyna Alicja Rogers" },
  { nif: "318618729", password: "YA9TXQAXZSP3", name: "Karoline Luiza Krac" },
  { nif: "254215017", password: "M_qv63c_kaNc8zE3", name: "Luis Fernando Dos Santos Rosado" },
  { nif: "232946060", password: "HMX7V5FEXJQ4", name: "Majda Machraa" },
  { nif: "110591232", password: "RUBENMADI", name: "Maria Manuela Ribeiro De Oliveira Sérgio" },
  { nif: "704781182", password: "ADELAIDE2018", name: "Maria Adelaide-cabeça de casal" },
  { nif: "188551069", password: "Pmsfin1965", name: "Maria Tereza De Oliveira Rolo Silva" },
  { nif: "304978485", password: "FWWADP6CC9LP", name: "Keston Mario Finch" },
  { nif: "300589999", password: "KAJGVMJRQRFS", name: "Marla Hannifa-Ruth Cattelona" },
  { nif: "311217559", password: "RHIJFIYENWNU", name: "Maximo Fava" },
  { nif: "314624775", password: "QFVYEBE32VKF", name: "Michael William Wilkinson" },
  { nif: "306424100", password: "N1PZQ9KH769F", name: "Nicolette McFadyen" },
  { nif: "217233716", password: "nunoines", name: "Nuno Miguel Antunes Gaspar" },
  { nif: "231858531", password: "videogamer", name: "Pedro Fernando Da Silva Martins" },
  { nif: "223107956", password: "oaqb5JZJ4Rfpxk", name: "Pedro Miguel Ferreira Palmeiro" },
  { nif: "229103294", password: "JUVELEO21", name: "Pedro Miguel Gonçalves Dos Santos" },
  { nif: "303069864", password: "PHUSHRHRBPBU", name: "Priska Paramitha Djohari" },
  // Page 3
  { nif: "211655864", password: "Vendas2014", name: "Rafael José Pereira Alves Marques Paisano" },
  { nif: "212321986", password: "Portugal2022", name: "Raquel Nogueira Gomes Duarte" },
  { nif: "270405658", password: "RENATOCHARRUA", name: "Renato De Jesus Ramalho Charrua" },
  { nif: "267331762", password: "TVFZPLVNXCWR", name: "Ruben Manuel Fortunato Romão" },
  { nif: "213599023", password: "HQ5V1HRFFKWH", name: "Rute Da Conceição Santos Ferreira Cebola" },
  { nif: "190443022", password: "Benfica3164", name: "Sandra Braga Estrela Brito" },
  { nif: "307497755", password: "SVJQHAAUAZKM", name: "Sara Ciriaci" },
  { nif: "295108045", password: "Guastini140", name: "Sérgio Knobloch De Andrade" },
  { nif: "271109041", password: "JUVELEO2021", name: "Sumitra Giri" },
  { nif: "244729204", password: "SMB244729204", name: "Susana Marina Alves Botelho" },
  { nif: "123576458", password: "susana54", name: "Aide Susana de Mendonça Martins" },
  { nif: "294631771", password: "Abrantes@240", name: "Sukhdeep Singh" },
  { nif: "306973367", password: "52BCWHJLSL5E", name: "Sylvain Hamide Belahniche" },
  { nif: "300610300", password: "300TAMARA", name: "Tamara Ardeljan" },
  { nif: "298100223", password: "Stlucia1995", name: "Teresa Melanie Shaw" },
  { nif: "207201986", password: "VANESSA2014", name: "Vanessa Cristina Flores Pargana Caldeira" },
  { nif: "152848940", password: "AMORIM2023", name: "Virgilio Dalot Da Costa Amorim" },
  { nif: "261188984", password: "CARINA1989", name: "Carina Filipa dos Santos Rodrigues" },
  { nif: "291056849", password: "VE3ACSGK62VC", name: "Rosadela Giron Hidalgo" },
  { nif: "304720704", password: "XLPJIMAOBXTF", name: "Diona Denkovska" },
  { nif: "318516837", password: "96wbak9R$zLyt$3L", name: "Odelia Maximov Zargari" },
  { nif: "284602426", password: "XB38MTVRP69B", name: "Anna Karina Leon Giron" },
  { nif: "297001469", password: "RTDFIIPAIDPL", name: "Fernando Lima Pereira Júnior" },
  { nif: "215224680", password: "MAFALDASOFIA", name: "Mafalda Sofia De Almeida Borda D'Água" },
  { nif: "316555673", password: "KZYAZJTMFISF", name: "Roberto Federico Frigerio" },
  { nif: "100814328", password: "comandos86_87", name: "José Manuel Rodrigues Da Costa" },
  { nif: "307103382", password: "ZNHUWGZUFVYQ", name: "Raphael Ematinger" },
  { nif: "201981106", password: "29041973", name: "Maria Jose Castro Machado" },
  { nif: "322184720", password: "!TX89Z8XTJ71Ms", name: "Sarah Hommel de Mendonça" },
  { nif: "318870223", password: "IGSQDCSYUMFZ", name: "Ruslan Goldin" },
  { nif: "322096529", password: "MYVSQTKVZRSN", name: "Jose Miguel Lara Badia" },
  { nif: "296694096", password: "WIKIJRDYOGHZ", name: "Patricia Vasques Maciel" },
  // Page 4
  { nif: "234880309", password: "99PI8RI28D88", name: "Ana Isa Ventureira Pinto" },
  { nif: "322099927", password: "TFEA8973KLS5", name: "Alvaro Andres Olias Soler" },
  { nif: "309936853", password: "BHPJGYGALQ6V", name: "Evgeniia Pisarevskaia" },
  { nif: "218457375", password: "PANTERA1977", name: "Agostinho José da Silva Santos" },
  { nif: "328371971", password: "QEGC5PU61WZ7", name: "Jacqueline Rose Francessca Currenti" },
  { nif: "220765898", password: "Financas21@", name: "Diandra Ribeiro Marques Paisano" },
  { nif: "313715734", password: "3GEXPTHZT5NN", name: "Lisa Adam" },
  { nif: "296845418", password: "05312946Dud@1998", name: "Flávia Duarte Pinto Bravo" },
  { nif: "266675581", password: "Manoca99", name: "Maria Ana Gaivão Vaz Pinto" },
  { nif: "191891932", password: "30076845", name: "Pedro Manuel Lopes Correia Tavares" },
  { nif: "309163579", password: "DRGJZDNWKNTN", name: "Bodo Lutz Fischer" },
  { nif: "215515170", password: "sporting_1", name: "Pedro Alexandre Sousa Alves De Brito" },
  { nif: "319649466", password: "DWDRSSMNYQVA", name: "Andre Groeschel" },
  { nif: "322597080", password: "UUR4V3L3PGA7", name: "Rafael Aguado Moscardo" },
  { nif: "320369480", password: "Carmit%2025", name: "Carmit Koren" },
  { nif: "305128310", password: "SC8GPFQZDPH2", name: "Kasja Katarina Sisojevic" },
  { nif: "185486711", password: "heloiseplima", name: "Heloise Maria Carapeto Pereira De Lima" },
  { nif: "318870410", password: "SXSWINTJCXHC", name: "Keren Goldin" },
  { nif: "304448508", password: "FNST7AD3T7DK", name: "Graeme Orr" },
  { nif: "234931965", password: "cM37CxzTvL4", name: "Claudia Baptista Lourenço Chatzifotiou" },
  { nif: "313715386", password: "ABEEJPZAFETA", name: "Rodrigo Enrique Gallegos Anda Dubke" },
  { nif: "318038625", password: "LCZTFISEOUZN", name: "Mandy Lisa Fransz" },
  { nif: "200817027", password: "PauloRaminhos25@", name: "Paulo Jorge da Costa Raminhos" },
  { nif: "270676520", password: "NZDZTRCDQEWS", name: "Tomás Marques de Sá Vilaça e Moura" },
  { nif: "303615109", password: "P9HJ8EL9V9DQ", name: "Lara Margot Van Uchelen" },
  { nif: "303614730", password: "ECG6G69AGGY2", name: "Theo Deluz" },
  { nif: "323912591", password: "YGYXQR3AA49K", name: "Mailin Maria Hulsmann" },
  { nif: "272964646", password: "ADIBKHQJUWJQ", name: "Dario Alexandre Soares Simão" },
  { nif: "263421333", password: "09111989", name: "Alexandru Crigan" },
  { nif: "188858270", password: "@ZXCVBNM*ala2025", name: "Maria Rosa da Cruz Alexandre" },
  { nif: "232883793", password: "SERRANOJLS", name: "Jose Lito Da Silva Serrano" },
  { nif: "243017375", password: "SERRANOMAS", name: "Maria Adelaide Da Silveira Serrano" },
  // Page 5
  { nif: "293882746", password: "TVATMGJJUAMF", name: "Erlisson Pinto de Oliveira" },
  { nif: "306967308", password: "JWEFVND9HEMR", name: "Jacek Jan Jaskola" },
  { nif: "232945993", password: "EUsouamor82", name: "Bilal Machraa" },
  { nif: "180143034", password: "CINAVE2015", name: "Cristina Maria Azevedo Martins Monteiro" },
  { nif: "109632303", password: "2014MVITORIA", name: "Matilde Maria Virginia Martinho Vitoria" },
  { nif: "227908635", password: "TKDPDEFVQDTO", name: "Daniel Alvarez Vidal" },
  { nif: "308707265", password: "Amulen.00", name: "Mateo Fava" },
  { nif: "259531235", password: "SpecialOnes3108", name: "Inês Martins dos Santos" },
  { nif: "198633149", password: "UK6V4RCCK3J3", name: "Nuno Ricardo Carapinha Dionisio" },
];

console.log(`\n📋 Re-encrypting AT credentials for ${credentials.length} clients`);
console.log(`   Supabase: ${SUPABASE_URL}`);
console.log(`   Accountant ID: ${ACCOUNTANT_ID}\n`);

// ── Call the edge function ───────────────────────────────────────────────

const url = `${SUPABASE_URL}/functions/v1/reencrypt-credentials`;

try {
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${SERVICE_KEY}`,
      'apikey': SERVICE_KEY,
    },
    body: JSON.stringify({
      credentials,
      accountant_id: ACCOUNTANT_ID,
    }),
  });

  const data = await response.json();

  if (!response.ok) {
    console.error('❌ Edge function error:', response.status, data);
    process.exit(1);
  }

  // ── Print summary ──────────────────────────────────────────────────
  const { summary, results } = data;

  console.log('═══════════════════════════════════════════');
  console.log(`✅ OK:        ${summary.ok}`);
  console.log(`⚠️  Not found: ${summary.not_found}`);
  console.log(`❌ Errors:    ${summary.errors}`);
  console.log(`📊 Total:     ${summary.total}`);
  console.log('═══════════════════════════════════════════\n');

  // Print not-found NIFs so user can investigate
  const notFound = results.filter(r => r.status === 'not_found');
  if (notFound.length > 0) {
    console.log('⚠️  NIFs not found in profiles table:');
    for (const r of notFound) {
      const cred = credentials.find(c => c.nif.replace(/\D/g, '') === r.nif);
      console.log(`   ${r.nif} — ${cred?.name || 'unknown'}`);
    }
    console.log('');
  }

  // Print errors
  const errors = results.filter(r => r.status === 'error');
  if (errors.length > 0) {
    console.log('❌ Errors:');
    for (const r of errors) {
      console.log(`   ${r.nif} (${r.clientName}) — ${r.error}`);
    }
    console.log('');
  }

  // Print first few successes
  const successes = results.filter(r => r.status === 'ok');
  if (successes.length > 0) {
    console.log(`✅ Successfully re-encrypted ${successes.length} credentials`);
    console.log('   First 5:');
    for (const r of successes.slice(0, 5)) {
      console.log(`   ${r.nif} → ${r.clientName} (${r.clientId})`);
    }
    if (successes.length > 5) {
      console.log(`   ... and ${successes.length - 5} more`);
    }
  }

} catch (err) {
  console.error('❌ Network error calling edge function:', err.message);
  console.error('   Make sure the function is deployed: supabase functions deploy reencrypt-credentials');
  process.exit(1);
}
