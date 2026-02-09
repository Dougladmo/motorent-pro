import React from 'react';
import { Database, Server, Smartphone, Shield, Layers, Code, GitBranch, Zap, CloudLightning } from 'lucide-react';

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
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-blue-600">
                    <Smartphone size={24} />
                </div>
                <h4 className="font-bold text-slate-700">Frontend (SPA)</h4>
                <p className="text-sm text-slate-500 mt-2">
                    React + "Cron" Lógico. 
                    <br/>
                    O próprio Admin dispara as rotinas ao abrir o app.
                </p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200 relative">
                <div className="absolute top-1/2 -left-5 hidden md:block w-6 border-t-2 border-slate-300 border-dashed"></div>
                <div className="absolute top-1/2 -right-5 hidden md:block w-6 border-t-2 border-slate-300 border-dashed"></div>
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-yellow-500">
                    <CloudLightning size={24} />
                </div>
                <h4 className="font-bold text-slate-700">Serverless Functions</h4>
                <p className="text-sm text-slate-500 mt-2">Vercel Functions / AWS Lambda. Autenticação leve e Proxy.</p>
            </div>
            <div className="text-center p-4 bg-slate-50 rounded-lg border border-slate-200">
                <div className="w-12 h-12 bg-white rounded-full flex items-center justify-center mx-auto mb-3 shadow-sm text-green-600">
                    <MessageCircle size={24} />
                </div>
                <h4 className="font-bold text-slate-700">WhatsApp Microservice</h4>
                <p className="text-sm text-slate-500 mt-2">API Evolution / Baileys. Recebe REST e envia mensagem.</p>
            </div>
        </div>
      </section>

      {/* Tech Stack */}
      <section className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
            <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Code className="text-slate-600" /> Stack Tecnológico Simplificado
            </h3>
            <ul className="space-y-3 text-sm">
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Frontend Logic</span>
                    <span className="font-medium text-slate-800">React Hook Cron</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Database</span>
                    <span className="font-medium text-slate-800">Supabase (Postgres) ou Firebase</span>
                </li>
                <li className="flex justify-between border-b border-slate-50 pb-2">
                    <span className="text-slate-500">Notificações</span>
                    <span className="font-medium text-slate-800">Chamada REST direta do Front</span>
                </li>
                 <li className="flex justify-between pt-1">
                    <span className="text-slate-500">Hospedagem</span>
                    <span className="font-medium text-slate-800">Vercel / Netlify</span>
                </li>
            </ul>
        </div>

        <div className="bg-white p-6 rounded-xl shadow-sm border border-slate-100">
             <h3 className="font-bold text-slate-800 mb-4 flex items-center gap-2">
                <Zap className="text-slate-600" /> Fluxo "Cron no Frontend"
            </h3>
            <div className="space-y-3 text-sm text-slate-600">
                <p>1. O Admin abre o painel.</p>
                <p>2. O sistema verifica datas de vencimento com base na última cobrança.</p>
                <p>3. Se <span className="font-mono bg-slate-100 px-1">hoje &gt;= vencimento</span>, gera nova cobrança no banco.</p>
                <p>4. Se <span className="font-mono bg-slate-100 px-1">hoje == vencimento</span>, chama API do WhatsApp.</p>
                <p className="text-xs text-slate-400 mt-2 italic">* Elimina custo de servidores 24/7. Depende do acesso diário do admin.</p>
            </div>
        </div>
      </section>

      {/* Roadmap */}
      <section className="bg-white p-8 rounded-xl shadow-sm border border-slate-100">
        <h3 className="text-lg font-bold text-slate-800 mb-6 flex items-center gap-2">
            <GitBranch className="text-purple-600" />
            Roadmap Atualizado
        </h3>
        <div className="relative border-l-2 border-slate-200 ml-3 space-y-8">
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-600 border-2 border-white shadow"></span>
                <h4 className="font-bold text-slate-800">Fase 1: MVP Client-Side (Atual)</h4>
                <p className="text-sm text-slate-500 mt-1">Lógica de geração de boletos rodando no browser. Mock de envio de WhatsApp.</p>
            </div>
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></span>
                <h4 className="font-bold text-slate-800">Fase 2: Integração Real WhatsApp</h4>
                <p className="text-sm text-slate-500 mt-1">Conectar o botão de envio à API do Evolution/Z-API.</p>
            </div>
            <div className="ml-6 relative">
                <span className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-slate-300 border-2 border-white"></span>
                <h4 className="font-bold text-slate-800">Fase 3: Persistência Cloud</h4>
                <p className="text-sm text-slate-500 mt-1">Migrar estado local (mocks) para Supabase ou Firebase.</p>
            </div>
        </div>
      </section>
    </div>
  );
};

// Icon import helper
import { MessageCircle } from 'lucide-react';