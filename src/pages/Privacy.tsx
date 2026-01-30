import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Shield } from "lucide-react";

const Privacy = () => {
  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto px-4 py-8">
        <Button asChild variant="ghost" className="mb-8">
          <Link to="/" className="gap-2">
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
        </Button>

        <div className="mx-auto max-w-3xl">
          <div className="mb-8 flex items-center gap-3">
            <Shield className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Política de Privacidade</h1>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Última atualização: Dezembro 2024
            </p>

            <h2>1. Introdução</h2>
            <p>
              O IVAzen ("nós", "nosso") está comprometido em 
              proteger a sua privacidade. Esta política explica como recolhemos, 
              usamos e protegemos os seus dados pessoais em conformidade com o 
              Regulamento Geral sobre a Proteção de Dados (RGPD).
            </p>

            <h2>2. Dados que Recolhemos</h2>
            <h3>2.1 Dados de Conta</h3>
            <ul>
              <li>Nome completo</li>
              <li>Endereço de email</li>
              <li>NIF (Número de Identificação Fiscal)</li>
              <li>Nome da empresa</li>
              <li>CAE (Código de Atividade Económica)</li>
            </ul>

            <h3>2.2 Dados de Facturas</h3>
            <ul>
              <li>Imagens de facturas carregadas</li>
              <li>Dados extraídos do QR Code (NIF fornecedor, valores, datas)</li>
              <li>Classificações de IVA</li>
            </ul>

            <h3>2.3 Dados de Utilização</h3>
            <ul>
              <li>Registos de acesso e atividade</li>
              <li>Preferências de configuração</li>
            </ul>

            <h2>3. Base Legal para Tratamento</h2>
            <p>Tratamos os seus dados com base em:</p>
            <ul>
              <li><strong>Execução de contrato:</strong> Para fornecer o Serviço</li>
              <li><strong>Interesse legítimo:</strong> Para melhorar o Serviço e segurança</li>
              <li><strong>Obrigação legal:</strong> Para cumprir requisitos fiscais</li>
              <li><strong>Consentimento:</strong> Para comunicações de marketing (opcional)</li>
            </ul>

            <h2>4. Como Usamos os Dados</h2>
            <ul>
              <li>Fornecer e melhorar o Serviço</li>
              <li>Treinar modelos de IA para classificação de IVA</li>
              <li>Comunicar sobre o Serviço e atualizações</li>
              <li>Cumprir obrigações legais</li>
              <li>Proteger contra fraude e uso indevido</li>
            </ul>

            <h2>5. Partilha de Dados</h2>
            <p>Não vendemos os seus dados. Podemos partilhar com:</p>
            <ul>
              <li><strong>Contabilistas autorizados:</strong> Que designou para gerir as suas facturas</li>
              <li><strong>Fornecedores de serviços:</strong> Que nos ajudam a operar o Serviço (hosting, email)</li>
              <li><strong>Autoridades:</strong> Quando legalmente obrigados</li>
            </ul>

            <h2>6. Segurança dos Dados</h2>
            <p>Implementamos medidas de segurança incluindo:</p>
            <ul>
              <li>Encriptação de dados em trânsito e em repouso</li>
              <li>Row Level Security (RLS) na base de dados</li>
              <li>Autenticação segura</li>
              <li>Monitorização de acessos</li>
              <li>Backups regulares</li>
            </ul>

            <h2>7. Retenção de Dados</h2>
            <p>
              Mantemos os seus dados enquanto a sua conta estiver ativa ou conforme 
              necessário para cumprir obrigações legais (mínimo 10 anos para dados 
              fiscais conforme lei portuguesa).
            </p>

            <h2>8. Os Seus Direitos (RGPD)</h2>
            <p>Tem direito a:</p>
            <ul>
              <li><strong>Acesso:</strong> Obter cópia dos seus dados</li>
              <li><strong>Retificação:</strong> Corrigir dados incorretos</li>
              <li><strong>Apagamento:</strong> Eliminar dados (com limitações legais)</li>
              <li><strong>Portabilidade:</strong> Receber dados em formato estruturado</li>
              <li><strong>Oposição:</strong> Opor-se a certos tratamentos</li>
              <li><strong>Limitação:</strong> Restringir o tratamento</li>
            </ul>
            <p>
              Para exercer estes direitos, contacte-nos através da{" "}
              <Link to="/contact" className="text-primary hover:underline">
                página de contacto
              </Link>.
            </p>

            <h2>9. Cookies</h2>
            <p>
              Utilizamos apenas cookies essenciais para o funcionamento do Serviço 
              (autenticação e preferências). Não utilizamos cookies de rastreamento 
              ou publicidade.
            </p>

            <h2>10. Alterações a Esta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Notificaremos 
              alterações significativas por email.
            </p>

            <h2>11. Contacto do DPO</h2>
            <p>
              Para questões sobre privacidade ou proteção de dados, contacte o 
              nosso Encarregado de Proteção de Dados através da{" "}
              <Link to="/contact" className="text-primary hover:underline">
                página de contacto
              </Link>.
            </p>

            <h2>12. Autoridade de Supervisão</h2>
            <p>
              Tem o direito de apresentar uma reclamação junto da Comissão Nacional 
              de Proteção de Dados (CNPD) se considerar que o tratamento dos seus 
              dados viola o RGPD.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Privacy;
