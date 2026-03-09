import React, { useState } from 'react';
import { LayoutDashboard, Bike, Users, Banknote, Plus, CheckCircle, MessageCircle, ChevronDown, ChevronUp, HelpCircle } from 'lucide-react';

interface AccordionProps {
  title: string;
  icon: React.ReactNode;
  accentColor: string;
  children: React.ReactNode;
}

const Accordion: React.FC<AccordionProps> = ({ title, icon, accentColor, children }) => {
  const [open, setOpen] = useState(false);
  return (
    <div className="bg-white rounded-xl shadow-sm border border-slate-100 overflow-hidden">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-6 py-5 text-left hover:bg-slate-50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <span className={`${accentColor}`}>{icon}</span>
          <span className="font-bold text-slate-800 text-base">{title}</span>
        </div>
        {open ? <ChevronUp size={18} className="text-slate-400" /> : <ChevronDown size={18} className="text-slate-400" />}
      </button>
      {open && (
        <div className="px-6 pb-6 border-t border-slate-100">
          {children}
        </div>
      )}
    </div>
  );
};

interface StepProps {
  number: number;
  text: string;
}

const Step: React.FC<StepProps> = ({ number, text }) => (
  <div className="flex items-start gap-3">
    <span className="flex-shrink-0 w-7 h-7 rounded-full bg-blue-600 text-white text-sm font-bold flex items-center justify-center mt-0.5">
      {number}
    </span>
    <p className="text-slate-600 text-sm leading-relaxed">{text}</p>
  </div>
);

interface TipProps {
  text: string;
}

const Tip: React.FC<TipProps> = ({ text }) => (
  <div className="mt-4 flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg p-3">
    <HelpCircle size={16} className="text-amber-500 flex-shrink-0 mt-0.5" />
    <p className="text-sm text-amber-800">{text}</p>
  </div>
);

export const Architecture: React.FC = () => {
  return (
    <div className="max-w-3xl mx-auto space-y-6 animate-fade-in pb-12">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Como usar o sistema</h2>
        <p className="text-slate-500 mt-1">Guia passo a passo para gerenciar suas motos, clientes e cobranças.</p>
      </header>

      {/* Visao geral */}
      <div className="bg-blue-600 text-white p-6 rounded-xl">
        <h3 className="font-bold text-lg mb-2">Bem-vindo ao MotoRent Pro</h3>
        <p className="text-blue-100 text-sm leading-relaxed">
          Este sistema foi feito para facilitar o dia a dia da sua locadora. Aqui você cadastra suas motos,
          registra seus clientes, cria aluguéis e acompanha todas as cobranças — tudo em um só lugar.
          Clique em cada seção abaixo para ver como funciona.
        </p>
      </div>

      {/* Dashboard */}
      <Accordion title="Dashboard — Visão geral do negócio" icon={<LayoutDashboard size={22} />} accentColor="text-blue-600">
        <div className="space-y-4 mt-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            O Dashboard é a primeira tela que você vê ao entrar no sistema. Ele mostra um resumo de tudo que está acontecendo na sua locadora.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-2">
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
              <p className="text-2xl font-bold text-blue-600">Receita</p>
              <p className="text-xs text-slate-500 mt-1">Quanto você recebeu no período</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
              <p className="text-2xl font-bold text-orange-500">Pendente</p>
              <p className="text-xs text-slate-500 mt-1">Cobranças que ainda não foram pagas</p>
            </div>
            <div className="bg-slate-50 rounded-lg p-4 border border-slate-200 text-center">
              <p className="text-2xl font-bold text-red-500">Atrasado</p>
              <p className="text-xs text-slate-500 mt-1">Cobranças com prazo vencido</p>
            </div>
          </div>
          <p className="text-slate-600 text-sm">
            Você pode filtrar os dados por <strong>semana</strong>, <strong>quinzena</strong> ou <strong>mês</strong> usando os botões no topo.
            O gráfico mostra a evolução da sua receita ao longo do tempo.
          </p>
          <Tip text="Use o Dashboard todo dia para saber rapidamente se há cobranças vencidas que precisam de atenção." />
        </div>
      </Accordion>

      {/* Motos */}
      <Accordion title="Motos — Cadastro da sua frota" icon={<Bike size={22} />} accentColor="text-orange-500">
        <div className="space-y-4 mt-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Na página de <strong>Motos</strong> você gerencia toda a sua frota. Veja quais motos estão disponíveis, quais estão alugadas e adicione novas motos ao cadastro.
          </p>
          <h4 className="font-semibold text-slate-700 text-sm">Como adicionar uma moto nova:</h4>
          <div className="space-y-3">
            <Step number={1} text='Clique no botão "Nova Moto" no canto superior direito da tela.' />
            <Step number={2} text="Preencha a placa, o modelo e o ano da moto." />
            <Step number={3} text="Se quiser, adicione uma foto da moto clicando na área de imagem." />
            <Step number={4} text='Clique em "Salvar". A moto aparecerá na lista como disponível.' />
          </div>
          <div className="mt-4 space-y-2">
            <h4 className="font-semibold text-slate-700 text-sm">Status das motos:</h4>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-green-500 inline-block"></span>
              <span className="text-sm text-slate-600"><strong>Disponível</strong> — a moto está livre para ser alugada.</span>
            </div>
            <div className="flex items-center gap-2">
              <span className="w-3 h-3 rounded-full bg-blue-500 inline-block"></span>
              <span className="text-sm text-slate-600"><strong>Alugada</strong> — a moto está com um cliente no momento.</span>
            </div>
          </div>
          <Tip text="Você pode excluir uma moto clicando no ícone de lixeira. Só é possível excluir motos que não estão alugadas." />
        </div>
      </Accordion>

      {/* Assinantes */}
      <Accordion title="Assinantes — Cadastro de clientes" icon={<Users size={22} />} accentColor="text-purple-600">
        <div className="space-y-4 mt-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Na página de <strong>Assinantes</strong> você mantém o cadastro dos seus clientes — as pessoas que alugam motos de você.
          </p>
          <h4 className="font-semibold text-slate-700 text-sm">Como cadastrar um novo cliente:</h4>
          <div className="space-y-3">
            <Step number={1} text='Clique em "Novo Assinante".' />
            <Step number={2} text="Preencha o nome completo, o telefone (WhatsApp) e o CPF do cliente." />
            <Step number={3} text='Clique em "Salvar". O cliente ficará disponível para criar um aluguel.' />
          </div>
          <h4 className="font-semibold text-slate-700 text-sm mt-2">Como criar um aluguel para o cliente:</h4>
          <div className="space-y-3">
            <Step number={1} text="Na lista de assinantes, localize o cliente desejado." />
            <Step number={2} text='Clique no botão com o ícone de moto (ou "Novo Aluguel") ao lado do nome do cliente.' />
            <Step number={3} text="Selecione a moto disponível, informe a data de início e o valor semanal do aluguel." />
            <Step number={4} text='Clique em "Confirmar". O sistema vai criar automaticamente as cobranças semanais a partir dessa data.' />
          </div>
          <Tip text="O número de telefone do cliente é usado para enviar lembretes de cobrança via WhatsApp. Certifique-se de que está correto e no formato com DDD." />
        </div>
      </Accordion>

      {/* Cobranças */}
      <Accordion title="Cobranças — Controle de pagamentos" icon={<Banknote size={22} />} accentColor="text-emerald-600">
        <div className="space-y-4 mt-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            Na página de <strong>Cobranças</strong> você acompanha todas as parcelas semanais dos seus clientes. O sistema gera as cobranças automaticamente — você só precisa registrar os pagamentos recebidos.
          </p>
          <h4 className="font-semibold text-slate-700 text-sm">Status das cobranças:</h4>
          <div className="space-y-2">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700 text-xs font-semibold">Pendente</span>
              <span className="text-sm text-slate-600">A cobrança ainda está dentro do prazo.</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <span className="px-2 py-0.5 rounded-full bg-red-100 text-red-700 text-xs font-semibold">Atrasada</span>
              <span className="text-sm text-slate-600">A data de vencimento já passou e o cliente não pagou.</span>
            </div>
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg p-3">
              <span className="px-2 py-0.5 rounded-full bg-green-100 text-green-700 text-xs font-semibold">Paga</span>
              <span className="text-sm text-slate-600">O pagamento foi confirmado.</span>
            </div>
          </div>
          <h4 className="font-semibold text-slate-700 text-sm mt-2">Informações na lista de cobranças:</h4>
          <div className="space-y-2">
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
              <Bike size={16} className="text-slate-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-slate-700">Moto da cobrança</p>
                <p className="text-sm text-slate-500 mt-0.5">Ao passar o mouse sobre o ícone de moto ao lado do nome do cliente, você vê o modelo e a placa da moto vinculada àquela cobrança.</p>
              </div>
            </div>
            <div className="flex items-start gap-3 bg-slate-50 rounded-lg p-3">
              <span className="text-[10px] font-semibold text-red-600 bg-red-50 border border-red-200 rounded px-1.5 py-0.5 flex-shrink-0 mt-0.5 whitespace-nowrap">N semanas em atraso</span>
              <div>
                <p className="text-sm font-medium text-slate-700">Contador de semanas em atraso</p>
                <p className="text-sm text-slate-500 mt-0.5">Para cobranças atrasadas, o sistema exibe quantas semanas o cliente está devendo. Isso ajuda a identificar rapidamente quem precisa de atenção urgente.</p>
              </div>
            </div>
          </div>
          <h4 className="font-semibold text-slate-700 text-sm mt-2">Como marcar uma cobrança como paga:</h4>
          <div className="space-y-3">
            <Step number={1} text="Encontre a cobrança do cliente na lista." />
            <Step number={2} text='Clique no botão com o ícone de check (confirmar pagamento) ao lado da cobrança.' />
            <Step number={3} text='O status muda para "Paga" e o valor entra na receita do Dashboard.' />
          </div>
          <Tip text='Use o filtro no topo da página para visualizar apenas cobranças "Atrasadas" e focar nos clientes que precisam de contato.' />
        </div>
      </Accordion>

      {/* WhatsApp */}
      <Accordion title="Lembretes via WhatsApp" icon={<MessageCircle size={22} />} accentColor="text-green-600">
        <div className="space-y-4 mt-4">
          <p className="text-slate-600 text-sm leading-relaxed">
            O sistema permite enviar lembretes de cobrança diretamente pelo WhatsApp para os seus clientes, sem precisar copiar nenhum número manualmente.
          </p>
          <h4 className="font-semibold text-slate-700 text-sm">Como enviar um lembrete manual:</h4>
          <div className="space-y-3">
            <Step number={1} text="Na página de Cobranças, localize a cobrança do cliente." />
            <Step number={2} text='Clique no botão com o ícone de WhatsApp (ou "Enviar lembrete").' />
            <Step number={3} text="O sistema envia automaticamente uma mensagem para o número cadastrado do cliente informando o valor e o vencimento." />
          </div>
          <div className="mt-4 bg-green-50 border border-green-200 rounded-lg p-4">
            <div className="flex items-start gap-2">
              <CheckCircle size={16} className="text-green-600 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-green-800">
                <strong>Cobrança automática:</strong> O sistema envia um lembrete automaticamente no dia do vencimento de cada cobrança, sem precisar de nenhuma ação sua.
              </p>
            </div>
          </div>
          <Tip text="Para que o envio funcione corretamente, o telefone do cliente deve estar cadastrado com o DDD. Exemplo: 92999998888." />
        </div>
      </Accordion>

      {/* Duvidas Frequentes */}
      <Accordion title="Duvidas frequentes" icon={<HelpCircle size={22} />} accentColor="text-slate-500">
        <div className="space-y-5 mt-4">
          <div>
            <p className="font-semibold text-slate-700 text-sm">As cobranças são geradas automaticamente?</p>
            <p className="text-slate-500 text-sm mt-1">Sim. Ao criar um aluguel, o sistema gera cobranças semanais automaticamente a partir da data de inicio. Voce nao precisa criar cada cobrança manualmente.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">O que acontece se eu nao marcar um pagamento como pago?</p>
            <p className="text-slate-500 text-sm mt-1">A cobrança passa para o status "Atrasada" automaticamente apos o vencimento. Ela continuara aparecendo na lista ate que voce a marque como paga.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">Posso excluir um cliente que tem aluguel ativo?</p>
            <p className="text-slate-500 text-sm mt-1">Nao e recomendado. Primeiro encerre o aluguel ativo do cliente, depois exclua o cadastro para nao perder o historico de cobranças.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">Como altero o valor semanal de um aluguel?</p>
            <p className="text-slate-500 text-sm mt-1">No momento, e necessario encerrar o aluguel atual e criar um novo com o valor atualizado. Futuras versoes do sistema permitirao editar diretamente.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">A foto da moto e obrigatoria?</p>
            <p className="text-slate-500 text-sm mt-1">Nao. A foto e opcional. Se nao for adicionada, o sistema exibe um icone padrao no lugar da imagem.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-700 text-sm">O que significa o contador de semanas em atraso?</p>
            <p className="text-slate-500 text-sm mt-1">O contador mostra quantas semanas o cliente está sem pagar. Como regra de negócio, contratos com <strong>3 ou mais semanas em atraso</strong> devem ser encerrados. Fique atento: quando o contador chegar em 3, entre em contato com o cliente e, se necessário, encerre o contrato na página de Assinantes.</p>
          </div>
        </div>
      </Accordion>

      {/* Rodape de ajuda */}
      <div className="text-center py-4">
        <p className="text-slate-400 text-sm">Ficou com alguma duvida? Entre em contato com o suporte.</p>
      </div>
    </div>
  );
};