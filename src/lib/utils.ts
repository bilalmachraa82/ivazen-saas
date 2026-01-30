import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Valida NIF português usando algoritmo check digit (mod 11)
 * @param nif - String de 9 dígitos
 * @returns { valid: boolean, error?: string }
 */
export function validateNIF(nif: string): { valid: boolean; error?: string } {
  if (!nif) return { valid: true }; // Campo opcional
  
  if (nif.length !== 9) {
    return { valid: false, error: 'O NIF deve ter 9 dígitos' };
  }
  
  if (!/^\d+$/.test(nif)) {
    return { valid: false, error: 'O NIF deve conter apenas números' };
  }
  
  // Primeiro dígito válido: 1, 2, 3, 5, 6, 7, 8, 9 (conforme AT)
  const firstDigit = nif[0];
  if (!['1', '2', '3', '5', '6', '7', '8', '9'].includes(firstDigit)) {
    return { valid: false, error: 'NIF inválido - primeiro dígito incorreto' };
  }
  
  // Algoritmo check digit mod 11
  const weights = [9, 8, 7, 6, 5, 4, 3, 2, 1];
  let sum = 0;
  for (let i = 0; i < 9; i++) {
    sum += parseInt(nif[i]) * weights[i];
  }
  
  if (sum % 11 !== 0) {
    return { valid: false, error: 'NIF inválido - dígito de controlo incorrecto' };
  }
  
  return { valid: true };
}

/**
 * Valida NISS português (Número de Identificação da Segurança Social)
 * Usa algoritmo com tabela de pesos primos
 * @param niss - String de 11 dígitos
 * @returns { valid: boolean, error?: string }
 */
export function validateNISS(niss: string): { valid: boolean; error?: string } {
  if (!niss) return { valid: true }; // Campo opcional
  
  if (niss.length !== 11) {
    return { valid: false, error: 'O NISS deve ter 11 dígitos' };
  }
  
  if (!/^\d+$/.test(niss)) {
    return { valid: false, error: 'O NISS deve conter apenas números' };
  }
  
  // Primeiro dígito válido: 1 ou 2
  const firstDigit = niss[0];
  if (firstDigit !== '1' && firstDigit !== '2') {
    return { valid: false, error: 'NISS inválido - primeiro dígito deve ser 1 ou 2' };
  }
  
  // Tabela de pesos (números primos em ordem decrescente)
  const weights = [29, 23, 19, 17, 13, 11, 7, 5, 3, 2];
  
  // Calcular soma ponderada dos primeiros 10 dígitos
  let sum = 0;
  for (let i = 0; i < 10; i++) {
    sum += parseInt(niss[i]) * weights[i];
  }
  
  // Dígito de controlo = 9 - (soma mod 10)
  const checkDigit = 9 - (sum % 10);
  const providedCheckDigit = parseInt(niss[10]);
  
  if (checkDigit !== providedCheckDigit) {
    return { valid: false, error: 'NISS inválido - dígito de controlo incorrecto' };
  }
  
  return { valid: true };
}
