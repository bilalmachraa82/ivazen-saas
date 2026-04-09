# Delivery Hardening Design

## Goal

Fechar os blockers que ainda impedem a entrega operacional do IVAzen ao gabinete de contabilidade:

1. eliminar crashes e overlays bloqueantes nos fluxos críticos de trabalho;
2. revalidar a aplicação em produção após deploy;
3. remediar o estado live de sincronização AT e de enriquecimento VIES.

## Scope

### Phase 1: Runtime blockers

- Corrigir o crash da rota `Reconciliação`.
- Corrigir o bloqueio da página `Compras` por onboarding legacy.
- Proteger contra regressão com testes focados.
- Fazer deploy e revalidar os fluxos críticos no browser.

### Phase 2: Operational remediation

- Diagnosticar e reduzir `at_credentials` em `error`/`partial`.
- Executar ou orquestrar backfill seguro de VIES para reduzir `supplier_name IS NULL`.
- Revalidar métricas live após reruns.

## Design Decisions

### 1. Reconciliação

O crash observado em produção vem de `ZenEmptyState` receber `variant="success"` sem esse variant existir no mapa interno. A correção deve ser defensiva e central:

- adicionar variants semânticos usados pelo produto (`success`, `warning`);
- deixar fallback seguro para `default` caso surja variant inesperado no futuro.

Isto corrige a rota atual e evita repetir o mesmo tipo de crash noutros ecrãs.

### 2. Compras / Validation

O overlay bloqueante vem do `OnboardingTour` legacy montado diretamente em `Validation.tsx`. Esse tour fullscreen não pertence ao fluxo atual de entrega e conflita com o onboarding unificado já existente no produto.

A correção mínima e segura é:

- remover o `OnboardingTour` legacy da página `Validation`;
- manter a navegação guiada não-bloqueante (`StepNavigator`) já presente.

### 3. Operação live

Os problemas live não devem ser “corrigidos” por adivinhação. O processo deve ser:

- estabilizar primeiro o runtime;
- só depois rerun/backfill com observação dos reason codes e contagens;
- validar novamente browser + queries live.

## Files Expected To Change

- `src/components/zen/ZenEmptyState.tsx`
- `src/pages/Validation.tsx`
- `src/components/zen/__tests__/ZenEmptyState.test.tsx`
- `src/lib/__tests__/validationRuntimeGuard.test.ts`
- `docs/superpowers/plans/2026-04-02-delivery-hardening.md`

## Success Criteria

- `Reconciliação` abre sem error boundary.
- `Compras` deixa de ficar bloqueada por modal fullscreen legacy.
- `npm test -- --run`, `npm run lint`, `npm run build` passam.
- Preview/produção mostram login, cliente Agostinho, `Compras`, `Reconciliação` e busca `mario` a funcionar.
- Após remediação live, `at_credentials` e `supplier_name` residual melhoram materialmente.

## Out Of Scope

- Refatoração ampla do onboarding.
- Reestruturação grande da reconciliação.
- Mudanças de produto não relacionadas com entrega operacional.
