import { isElectronicImport } from './imagePathUtils';
import { normalizeSupplierName } from './supplierNameResolver';

export interface DuplicateCandidate {
  created_at?: string | null;
  image_path?: string | null;
  import_source?: string | null;
  status?: string | null;
  supplier_name?: string | null;
  supplier_nif?: string | null;
}

function getDuplicateScore(candidate: DuplicateCandidate): number {
  let score = 0;

  const imagePath = candidate.image_path?.trim() || null;
  if (imagePath && !isElectronicImport(imagePath)) {
    score += 100;
  }

  if (candidate.status === 'validated') {
    score += 40;
  } else if (candidate.status === 'classified') {
    score += 20;
  }

  if (normalizeSupplierName(candidate.supplier_name, candidate.supplier_nif)) {
    score += 10;
  }

  if (candidate.import_source === 'manual' || candidate.import_source === 'ocr') {
    score += 5;
  }

  return score;
}

export function pickDuplicateKeepIndex<T extends DuplicateCandidate>(candidates: T[]): number {
  if (candidates.length === 0) return -1;

  return candidates.reduce((bestIndex, candidate, index) => {
    const bestCandidate = candidates[bestIndex];
    const candidateScore = getDuplicateScore(candidate);
    const bestScore = getDuplicateScore(bestCandidate);

    if (candidateScore > bestScore) {
      return index;
    }

    if (candidateScore < bestScore) {
      return bestIndex;
    }

    const candidateCreatedAt = candidate.created_at ? new Date(candidate.created_at).getTime() : Number.POSITIVE_INFINITY;
    const bestCreatedAt = bestCandidate.created_at ? new Date(bestCandidate.created_at).getTime() : Number.POSITIVE_INFINITY;

    if (candidateCreatedAt < bestCreatedAt) {
      return index;
    }

    return bestIndex;
  }, 0);
}
