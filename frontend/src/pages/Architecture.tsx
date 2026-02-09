import React from 'react';
import { Database, Server, Smartphone, Shield, Layers, Code, GitBranch, Zap, CloudLightning, MessageCircle } from 'lucide-react';

export const Architecture: React.FC = () => {
  return (
    <div className="max-w-4xl mx-auto space-y-8 animate-fade-in pb-12">
      <header>
        <h2 className="text-2xl font-bold text-slate-800">Arquitetura do Sistema</h2>
        <p className="text-slate-500">Documentação técnica e roadmap do projeto.</p>
      </header>

      {/* Overview Diagram Concept */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Layers className="text-blue-600" />
            Visão Geral da Solução
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-blue-600">
                    <Smartphone size={24} />
                </div>
                <h4 className="font-bold text-slate-700">Frontend (SPA)</h4>
                <p className="text-sm text-slate-500 mt-2">
                    React 19 + TypeScript + Vite
                    <br/>
                    Geração automática de cobranças semanais
                </p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-purple-600">
                    <Server size={24} />
                </div>
                <h4 className="font-bold text-slate-700">Backend API</h4>
                <p className="text-sm text-slate-500 mt-2">
                    Node.js + Express + TypeScript
                    <br/>
                    Upload de imagens com Multer
                </p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-emerald-600">
                    <Database size={24} />
                </div>
                <h4 className="font-bold text-slate-700">Supabase</h4>
                <p className="text-sm text-slate-500 mt-2">
                    PostgreSQL Database
                    <br/>
                    Storage para imagens
                </p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-green-600">
                    <MessageCircle size={24} />
                </div>
                <h4 className="font-bold text-slate-700">WhatsApp API</h4>
                <p className="text-sm text-slate-500 mt-2">
                    Evolution API / Baileys
                    <br/>
                    Notificações automáticas
                </p>
            </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Code className="text-slate-600" /> Stack Tecnológico
            </h3>
            <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Frontend</span>
                    <span className="font-medium text-slate-800">React 19 + Vite + TypeScript</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Backend</span>
                    <span className="font-medium text-slate-800">Node.js + Express + TypeScript</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Database</span>
                    <span className="font-medium text-slate-800">Supabase (PostgreSQL)</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Storage</span>
                    <span className="font-medium text-slate-800">Supabase Storage</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Upload</span>
                    <span className="font-medium text-slate-800">Multer Middleware</span>
                </li>
                 <li className="flex justify-between pt-1">
                    <span className="text-slate-500">Hospedagem</span>
                    <span className="font-medium text-slate-800">Vercel (planejado)</span>
                </li>
            </ul>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Zap className="text-slate-600" /> Geração Automática de Cobranças
            </h3>
            <div className="space-y-3 text-sm text-slate-600">
                <p><strong>Trigger:</strong> useEffect monitora mudanças em aluguéis e assinantes</p>
                <p><strong>Frequência:</strong> Semanal (7 dias) baseado na data de início</p>
                <p><strong>Lookahead:</strong> Gera cobranças até 7 dias no futuro</p>
                <p><strong>Status:</strong></p>
                <ul className="ml-4 space-y-1">
                    <li>• Vencidas → <span className="font-mono bg-red-50 text-red-700 px-1">OVERDUE</span></li>
                    <li>• Futuras → <span className="font-mono bg-yellow-50 text-yellow-700 px-1">PENDING</span></li>
                    <li>• Pagas → <span className="font-mono bg-green-50 text-green-700 px-1">PAID</span></li>
                </ul>
                <p className="text-xs text-slate-400 mt-2 italic">
                    * Notificações WhatsApp automáticas para cobranças vencendo hoje
                </p>
            </div>
        </div>
      </section>

      {/* Data Model */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Database className="text-emerald-600" />
            Modelo de Dados e Relacionamentos
        </h3>
        <div className="space-y-6">
            <div className="p-4 bg-slate-50 rounded-lg border border-slate-200">
                <h4 className="font-bold text-slate-700 mb-3">Entidades Principais</h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                    <div>
                        <p className="font-mono text-blue-600 mb-2">Motorcycle</p>
                        <ul className="text-slate-600 space-y-1 ml-4">
                            <li>• plate, model, year</li>
                            <li>• status (AVAILABLE | RENTED)</li>
                            <li>• <strong>image_url</strong> (Supabase Storage)</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-blue-600 mb-2">Subscriber (Cliente)</p>
                        <ul className="text-slate-600 space-y-1 ml-4">
                            <li>• name, phone, cpf</li>
                            <li>• Relacionamento: 1:N com Rental</li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-blue-600 mb-2">Rental (Aluguel)</p>
                        <ul className="text-slate-600 space-y-1 ml-4">
                            <li>• motorcycleId, subscriberId</li>
                            <li>• startDate, weeklyPrice</li>
                            <li>• <strong>Gera pagamentos semanais</strong></li>
                        </ul>
                    </div>
                    <div>
                        <p className="font-mono text-blue-600 mb-2">Payment (Cobrança)</p>
                        <ul className="text-slate-600 space-y-1 ml-4">
                            <li>• rentalId, subscriberName</li>
                            <li>• dueDate, amount</li>
                            <li>• status (PENDING | OVERDUE | PAID)</li>
                        </ul>
                    </div>
                </div>
            </div>

            <div className="p-4 bg-blue-50 rounded-lg border border-blue-200">
                <h4 className="font-bold text-blue-900 mb-2">Fluxo de Upload de Imagens</h4>
                <div className="space-y-2 text-sm text-blue-800">
                    <p>1. <strong>Frontend:</strong> Formulário com preview + validação (tipo e tamanho)</p>
                    <p>2. <strong>POST /api/motorcycles/with-image:</strong> FormData com imagem + dados da moto</p>
                    <p>3. <strong>Multer:</strong> Processa multipart/form-data em memória</p>
                    <p>4. <strong>uploadService:</strong> Upload para bucket <code className="bg-blue-100 px-1">motorcycle-images</code></p>
                    <p>5. <strong>Supabase Storage:</strong> Retorna URL pública da imagem</p>
                    <p>6. <strong>Database:</strong> Salva moto com <code className="bg-blue-100 px-1">image_url</code></p>
                </div>
            </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <GitBranch className="text-purple-600" />
            Roadmap de Desenvolvimento
        </h3>
        <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-green-600 border-2 border-white shadow"></span>
                <h4 className="font-bold text-slate-800">✅ Fase 1: Backend e Infraestrutura (Concluído)</h4>
                <ul className="text-sm text-slate-500 mt-2 space-y-1 ml-4">
                    <li>• Backend Node.js/Express com TypeScript</li>
                    <li>• Integração com Supabase (PostgreSQL + Storage)</li>
                    <li>• Upload de imagens de motos com Multer</li>
                    <li>• Sistema de geração automática de cobranças semanais</li>
                </ul>
            </div>
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow"></span>
                <h4 className="font-bold text-slate-800">🔄 Fase 2: Integração de Dados (Em Andamento)</h4>
                <ul className="text-sm text-slate-500 mt-2 space-y-1 ml-4">
                    <li>• Migrar estado do AppContext para API REST</li>
                    <li>• Conectar operações CRUD ao backend</li>
                    <li>• Implementar controllers para pagamentos</li>
                    <li>• Persistir cobranças geradas no Supabase</li>
                </ul>
            </div>
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></span>
                <h4 className="font-bold text-slate-800">📋 Fase 3: Integração WhatsApp (Próximo)</h4>
                <ul className="text-sm text-slate-500 mt-2 space-y-1 ml-4">
                    <li>• Integrar Evolution API / Baileys</li>
                    <li>• Implementar envio real de notificações</li>
                    <li>• Configurar templates de mensagens</li>
                    <li>• Sistema de retry para falhas de envio</li>
                </ul>
            </div>
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></span>
                <h4 className="font-bold text-slate-800">🚀 Fase 4: Deploy e Produção (Planejado)</h4>
                <ul className="text-sm text-slate-500 mt-2 space-y-1 ml-4">
                    <li>• Deploy na Vercel (frontend + backend)</li>
                    <li>• Configuração de variáveis de ambiente</li>
                    <li>• Testes end-to-end em produção</li>
                    <li>• Monitoramento e logs</li>
                </ul>
            </div>
        </div>
      </section>

      {/* Security & Best Practices */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Shield className="text-indigo-600" />
            Segurança e Boas Práticas
        </h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="space-y-3">
                <h4 className="font-bold text-slate-700 text-sm">Backend</h4>
                <ul className="text-sm text-slate-600 space-y-2 ml-4">
                    <li>• <strong>Validação de arquivos:</strong> Tipo (JPEG/PNG/WEBP) e tamanho (max 5MB)</li>
                    <li>• <strong>CORS configurado:</strong> Origem específica do frontend</li>
                    <li>• <strong>Helmet:</strong> Headers de segurança HTTP</li>
                    <li>• <strong>TypeScript:</strong> Type safety em toda API</li>
                    <li>• <strong>Error handling:</strong> Tratamento centralizado de erros</li>
                </ul>
            </div>
            <div className="space-y-3">
                <h4 className="font-bold text-slate-700 text-sm">Supabase</h4>
                <ul className="text-sm text-slate-600 space-y-2 ml-4">
                    <li>• <strong>RLS Policies:</strong> Controle de acesso a nível de row</li>
                    <li>• <strong>Storage bucket público:</strong> Apenas leitura pública de imagens</li>
                    <li>• <strong>Environment variables:</strong> Credenciais em .env</li>
                    <li>• <strong>UUID filenames:</strong> Previne conflitos de nomes</li>
                    <li>• <strong>PostgreSQL:</strong> ACID compliance e transações</li>
                </ul>
            </div>
        </div>
      </section>

      {/* Payment Automation Details */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <Zap className="text-yellow-600" />
            Sistema de Pagamentos Automáticos
        </h3>
        <div className="space-y-4">
            <div className="p-4 bg-yellow-50 rounded-lg border border-yellow-200">
                <h4 className="font-bold text-yellow-900 mb-2">Geração Inteligente de Cobranças</h4>
                <p className="text-sm text-yellow-800 mb-3">
                    O sistema utiliza um "cron job" no frontend (useEffect) para gerar cobranças semanais automaticamente:
                </p>
                <ul className="text-sm text-yellow-800 space-y-2 ml-4">
                    <li><strong>1. Trigger:</strong> Ativação ao montar componente ou quando rentals/subscribers mudam</li>
                    <li><strong>2. Cálculo:</strong> Para cada rental ativo, calcula datas de vencimento semanais (a cada 7 dias)</li>
                    <li><strong>3. Lookahead:</strong> Gera cobranças até 7 dias no futuro (previne gaps)</li>
                    <li><strong>4. Deduplicação:</strong> Verifica cobranças existentes antes de criar novas</li>
                    <li><strong>5. Status:</strong> Define OVERDUE (vencidas), PENDING (futuras) ou mantém PAID (pagas)</li>
                    <li><strong>6. Notificação:</strong> Simula envio WhatsApp para cobranças vencendo hoje</li>
                </ul>
            </div>

            <div className="p-4 bg-green-50 rounded-lg border border-green-200">
                <h4 className="font-bold text-green-900 mb-2">Integração WhatsApp (Planejada)</h4>
                <p className="text-sm text-green-800">
                    <strong>Atual:</strong> Simulação via console.log agregando dívidas totais por cliente
                  <br/>
                  <strong>Próximo:</strong> Integração real com Evolution API / Baileys para envio de notificações automáticas e lembretes manuais
                </p>
            </div>
        </div>
      </section>
    </div>
  );
};