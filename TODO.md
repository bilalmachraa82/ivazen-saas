# IVAzen SaaS - TODO & Estado Actual

**Última actualização:** 2025-01-31
**Estado global:** ~65% completo

---

## ✅ Concluído

### Rebranding (2025-01-31)
- [x] Removidas todas as referências a "Accounting Advantage" do código
- [x] Landing.tsx - 9 referências substituídas
- [x] Contact.tsx - 2 referências substituídas
- [x] EmitterDataForm.tsx - placeholder actualizado
- [x] modelo10ExcelGenerator.ts - comentário actualizado
- [x] emitterStorage.ts - comentário actualizado

### Segurança (2025-01-31)
- [x] `.env` removido do git tracking
- [x] `.env.example` criado como template
- [x] PDFs com dados reais removidos do git
- [x] `.gitignore` actualizado (env files, PDFs, xlsx)
- [x] PDFs movidos para `test-data/` (não tracked)

### Funcionalidades Core
- [x] OCR de facturas (Gemini Vision)
- [x] Extracção automática de dados
- [x] Classificação por categoria IVA
- [x] Dashboard com estatísticas
- [x] Autenticação Supabase
- [x] Landing page responsiva
- [x] Páginas Contact, Privacy, Terms
- [x] Modo escuro/claro

---

## 🚧 Em Progresso

### UI/UX
- [ ] Responsive tweaks para mobile
- [ ] Loading states mais informativos
- [ ] Error handling melhorado

---

## ❌ Por Fazer

### Alta Prioridade
- [ ] **Stripe Integration** - Sistema de billing/subscrições
  - ⚠️ BLOCKER: Complexo, requer validação do Luis
- [ ] **Multi-tenant** - Suporte para múltiplas empresas
- [ ] **Email notifications** - Lembretes de IVA

### Média Prioridade
- [ ] Exportação para formato AT
- [ ] Relatórios PDF
- [ ] Histórico de facturas
- [ ] Backup automático de dados

### Baixa Prioridade
- [ ] App mobile (PWA ou React Native)
- [ ] API pública
- [ ] Integração com software de contabilidade

---

## 🔴 Bloqueadores

1. **Stripe Integration**
   - Requer decisão de pricing
   - Configuração de webhooks
   - Testes de pagamento
   - **Acção:** Validar com Luis antes de implementar

2. **Domínio & DNS**
   - ivazen.pt ou similar?
   - SSL/certificados
   - **Acção:** Decidir domínio final

---

## 📝 Notas

### Estrutura do Projecto
```
src/
├── components/     # Componentes React
├── pages/          # Páginas principais
├── lib/            # Utilitários e lógica
├── hooks/          # Custom hooks
└── types/          # TypeScript types
```

### Stack
- **Frontend:** React + TypeScript + Vite
- **Styling:** Tailwind CSS + shadcn/ui
- **Backend:** Supabase (Auth + DB)
- **OCR:** Google Gemini Vision API
- **Deploy:** Vercel (planned)

### Contacto Dev Team
- **Jira:** https://aiparati.atlassian.net (projecto DEV)
- **Repo:** https://github.com/bilalmachraa82/ivazen-saas
