/**
 * Robust JSON extraction from AI model responses.
 *
 * Handles common issues:
 * 1. Markdown code blocks (```json ... ```)
 * 2. Reasoning/thinking tokens before JSON
 * 3. Multiple JSON objects (takes the last valid one)
 * 4. Text wrapping around JSON
 */
export function parseJsonFromAI<T = unknown>(content: string): T {
  // 1. Direct parse — fast path when model returns clean JSON
  try {
    return JSON.parse(content) as T;
  } catch {
    // continue to fallbacks
  }

  let cleaned = content;

  // 2. Strip markdown code blocks
  const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlockMatch) {
    try {
      return JSON.parse(codeBlockMatch[1].trim()) as T;
    } catch {
      cleaned = codeBlockMatch[1].trim();
    }
  }

  // 3. Strip XML-like tags (e.g. <thinking>...</thinking>, <output>...</output>)
  cleaned = cleaned.replace(/<\/?(?:thinking|output|response|result|answer)[^>]*>/gi, '');

  // 4. Find JSON objects — try all matches, return the LAST valid one
  //    (AI often puts reasoning before the actual JSON)
  const objectMatches = [...cleaned.matchAll(/\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g)];
  if (objectMatches.length > 0) {
    // Try from last to first (last is usually the final answer)
    for (let i = objectMatches.length - 1; i >= 0; i--) {
      try {
        return JSON.parse(objectMatches[i][0]) as T;
      } catch {
        // try next
      }
    }
  }

  // 5. Last resort: greedy match (first { to last })
  const greedyMatch = cleaned.match(/\{[\s\S]*\}/);
  if (greedyMatch) {
    try {
      return JSON.parse(greedyMatch[0]) as T;
    } catch {
      // fall through
    }
  }

  throw new Error('No valid JSON found in AI response');
}
