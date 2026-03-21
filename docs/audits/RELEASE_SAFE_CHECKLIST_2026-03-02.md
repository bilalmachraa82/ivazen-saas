# Release Safe Checklist (2026-03-02)

## Status
- [x] P0 auth bypass patch aplicado em funções edge críticas
- [x] Regressão de auth bloqueada no script `check-edge-auth-guards.mjs`
- [x] Test suite verde (`621/621`)

## Blockers Antes de Produção
- [ ] Remover SQL operacional sensível de `supabase/migrations` (`B2/B3/B5/B6`) e mover para pasta `ops/`
- [ ] Revogar/forçar reset das passwords temporárias migradas
- [ ] Confirmar rotação de secrets em produção após migração

## AT Sync (Obrigatório para fluxo automático)
- [ ] Provisionar VPS para `services/at-connector`
- [ ] Instalar certificado AT mTLS (PFX/PEM)
- [ ] Expor HTTPS seguro (Caddy ou Nginx)
- [ ] Definir secrets no Supabase:
  - `AT_CONNECTOR_URL`
  - `AT_CONNECTOR_TOKEN`
  - `AT_CONNECTOR_CA_CERT` ou `AT_CONNECTOR_CA_CERT_B64`
  - `AT_ENCRYPTION_KEY`
- [ ] Testar `sync-efatura` para pelo menos 1 cliente com credenciais válidas
- [ ] Validar `at_sync_history` com método `api` e sem erros de auth

## Operacional
- [ ] Configurar `VITE_SENTRY_DSN` no frontend deploy
- [ ] Garantir CI com `check-edge-auth` + testes em pull requests
- [ ] Executar smoke test funcional:
  - Login contabilista
  - Sync compras/vendas AT
  - Modelo 10 import/process/export
  - Segurança Social e IVA sem regressões

## Gate Final (GO)
- [ ] Nenhum endpoint com bypass de auth
- [ ] AT sync automático a funcionar com connector
- [ ] Sem migrações sensíveis pendentes para execução automática
- [ ] Logs de erro sem regressões críticas nas últimas 24h
