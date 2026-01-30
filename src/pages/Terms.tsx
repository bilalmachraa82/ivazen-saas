import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ArrowLeft, FileText } from "lucide-react";

const Terms = () => {
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
            <FileText className="h-8 w-8 text-primary" />
            <h1 className="text-3xl font-bold">Termos de Serviço</h1>
          </div>

          <div className="prose prose-neutral dark:prose-invert max-w-none">
            <p className="text-muted-foreground">
              Última atualização: Dezembro 2024
            </p>

            <h2>1. Aceitação dos Termos</h2>
            <p>
              Ao aceder e utilizar a aplicação IVAzen ("Serviço"), 
              concorda em ficar vinculado a estes Termos de Serviço. Se não concordar 
              com qualquer parte destes termos, não poderá aceder ao Serviço.
            </p>

            <h2>2. Descrição do Serviço</h2>
            <p>
              O IVAzen é uma aplicação de assistência à gestão de IVA que permite:
            </p>
            <ul>
              <li>Digitalização de facturas através de QR Code</li>
              <li>Classificação automática de despesas para efeitos de IVA</li>
              <li>Validação e correção por contabilistas certificados</li>
              <li>Exportação de dados para software de contabilidade</li>
            </ul>

            <h2>3. Contas de Utilizador</h2>
            <p>
              Para utilizar o Serviço, deve criar uma conta fornecendo informações 
              precisas e completas. É responsável por:
            </p>
            <ul>
              <li>Manter a confidencialidade das suas credenciais</li>
              <li>Todas as atividades realizadas na sua conta</li>
              <li>Notificar-nos imediatamente de qualquer uso não autorizado</li>
            </ul>

            <h2>4. Uso Aceitável</h2>
            <p>Concorda em não utilizar o Serviço para:</p>
            <ul>
              <li>Violar qualquer lei ou regulamento aplicável</li>
              <li>Transmitir dados falsos ou fraudulentos</li>
              <li>Interferir com a segurança ou integridade do Serviço</li>
              <li>Aceder a dados de outros utilizadores sem autorização</li>
            </ul>

            <h2>5. Propriedade Intelectual</h2>
            <p>
              O Serviço e o seu conteúdo original, funcionalidades e design são 
              propriedade exclusiva do IVAzen e estão protegidos por leis de 
              propriedade intelectual portuguesas e internacionais.
            </p>

            <h2>6. Limitação de Responsabilidade</h2>
            <p>
              A classificação de IVA fornecida pela IA é uma sugestão e deve ser 
              sempre validada por um profissional de contabilidade. Não nos 
              responsabilizamos por:
            </p>
            <ul>
              <li>Erros de classificação não corrigidos pelo utilizador</li>
              <li>Decisões fiscais tomadas com base nas sugestões da IA</li>
              <li>Perdas resultantes de interrupções do Serviço</li>
            </ul>

            <h2>7. Alterações aos Termos</h2>
            <p>
              Reservamo-nos o direito de modificar estes termos a qualquer momento. 
              Notificaremos alterações significativas por email ou através do Serviço.
            </p>

            <h2>8. Lei Aplicável</h2>
            <p>
              Estes Termos são regidos pela lei portuguesa. Qualquer disputa será 
              submetida aos tribunais portugueses competentes.
            </p>

            <h2>9. Contacto</h2>
            <p>
              Para questões sobre estes Termos, contacte-nos através da{" "}
              <Link to="/contact" className="text-primary hover:underline">
                página de contacto
              </Link>.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Terms;
