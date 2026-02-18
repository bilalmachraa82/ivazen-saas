# Release Note: EDP Reextract Guardrails (2026-02)

## Scope
Fecho da reconciliacao Justyna Q3 2025 com reextracao controlada de faturas EDP.

## Changes
1. Sanity gate EDP reforcado para bloquear sobrecontagem em fallback OCR.
2. Reextracao via UI mantém overrides manuais (`final_*`, `exclusion_reason`).
3. `total_amount` preservado durante reextracao (nao sobrescrever automaticamente).
4. Adicionado teste automatizado para o gate EDP.

## Evidence (benchmark case)
- EDP Jul: 11.18
- EDP Ago: 8.98
- EDP Set: 8.64
- Compras incluidas: 42.17
- Campo 41: 0.27
- Campo 24 liquido: 41.90
- Vendas Q3: 4,159.50

## Verification Commands
```bash
npm test
npm run build
```

## Operational Notes
- Quando houver valor stale em OCR anterior, usar `Re-extrair OCR` no detalhe da fatura.
- Nao usar SQL manual para "forcar" `total_vat` em reconciliacao.
- Guardar sempre output das queries de evidencia com timestamp.

