import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Bot, MessageSquare, ArrowRight, CheckCircle2, Camera, MapPin, FileText, User, Mail, Phone, Home, Hash, Map, AlertCircle, HelpCircle } from "lucide-react";

// Estrutura do fluxo baseado no código do whatsapp-ai-agent
const ETAPAS_FLUXO = [
  { id: 'dados_pessoais', label: 'Dados Pessoais', icon: User, campos: ['nome', 'email'] },
  { id: 'localizacao', label: 'Localização', icon: MapPin, campos: ['bairro', 'rua', 'numero', 'referencia'] },
  { id: 'tipo_problema', label: 'Tipo do Problema', icon: AlertCircle, campos: ['categoria'] },
  { id: 'descricao', label: 'Descrição', icon: FileText, campos: ['descricao'] },
  { id: 'midia', label: 'Mídia', icon: Camera, campos: ['fotos', 'videos'] },
  { id: 'confirmacao', label: 'Confirmação', icon: CheckCircle2, campos: [] },
];

const TIPOS_PROBLEMA = [
  { id: 'buraco', label: 'Buraco na rua', numero: 1 },
  { id: 'danificada', label: 'Rua danificada', numero: 2 },
  { id: 'alagada', label: 'Rua alagada', numero: 3 },
  { id: 'desnivel', label: 'Desnível na pista', numero: 4 },
  { id: 'dificil', label: 'Rua difícil de trafegar', numero: 5 },
  { id: 'outro', label: 'Outro problema', numero: 6 },
];

const COMANDOS = [
  { comando: '/consultar [PROTOCOLO]', descricao: 'Consulta o status de uma reclamação pelo número do protocolo' },
  { comando: '/minhas', descricao: 'Lista as últimas reclamações do cidadão' },
  { comando: '/cancelar', descricao: 'Cancela a reclamação em andamento' },
  { comando: 'consultar [PROTOCOLO]', descricao: 'Alternativa sem barra - mesma função' },
];

const RESPOSTAS_AUTOMATICAS = [
  {
    gatilho: 'Saudação (oi, olá, bom dia)',
    tipo: 'Usuario Novo',
    resposta: 'Olá! 😊 Para começar seu cadastro, qual é o seu *nome completo*?',
  },
  {
    gatilho: 'Saudação (oi, olá, bom dia)',
    tipo: 'Usuario Recorrente',
    resposta: 'Olá, *{nome}*! 😊 Já te reconheci por aqui.\n\nMe diga o *bairro* e a *rua* onde está o problema.',
  },
  {
    gatilho: 'Mídia recebida (foto/vídeo)',
    tipo: 'Confirmação',
    resposta: '✅ Mídia recebida: {quantidade}.\n\nSe quiser enviar mais, pode mandar agora.\n\nOu digite 1️⃣ para *revisar e enviar*',
  },
  {
    gatilho: 'Pular mídia (não, próximo)',
    tipo: 'Navegação',
    resposta: '📋 *Revisão da sua reclamação*\n\n[Resumo dos dados coletados]',
  },
  {
    gatilho: 'Confirmação (1, sim, confirmar)',
    tipo: 'Sucesso',
    resposta: '✅ Reclamação registrada com sucesso.\n\n📋 *Protocolo:* {protocolo}\n\n[Detalhes da reclamação]',
  },
  {
    gatilho: 'Protocolo digitado',
    tipo: 'Consulta',
    resposta: '📋 *Consulta de Protocolo*\n\n*Protocolo:* {protocolo}\n*Status:* {status}\n*Local:* {endereco}\n[Histórico de movimentações]',
  },
];

const AdminWhatsAppBot = () => {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
          <Bot className="w-7 h-7 text-primary" />
          Estrutura do Robô WhatsApp
        </h1>
        <p className="text-muted-foreground mt-1">
          Visualização da estrutura e fluxo do agente de IA para WhatsApp
        </p>
      </div>

      <Tabs defaultValue="fluxo" className="w-full">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="fluxo">Fluxo de Etapas</TabsTrigger>
          <TabsTrigger value="comandos">Comandos</TabsTrigger>
          <TabsTrigger value="respostas">Respostas Automáticas</TabsTrigger>
          <TabsTrigger value="codigo">Estrutura do Código</TabsTrigger>
        </TabsList>

        {/* Fluxo de Etapas */}
        <TabsContent value="fluxo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <ArrowRight className="w-5 h-5" />
                Fluxo de Coleta de Dados
              </CardTitle>
              <CardDescription>
                O robô segue este fluxo para coletar informações do cidadão
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-2">
                {ETAPAS_FLUXO.map((etapa, index) => (
                  <div key={etapa.id} className="flex items-center gap-2">
                    <div className="flex flex-col items-center p-3 bg-muted rounded-lg min-w-[120px]">
                      <etapa.icon className="w-6 h-6 text-primary mb-1" />
                      <span className="text-sm font-medium text-center">{etapa.label}</span>
                      <div className="flex flex-wrap gap-1 mt-2 justify-center">
                        {etapa.campos.map(campo => (
                          <Badge key={campo} variant="outline" className="text-xs">
                            {campo}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    {index < ETAPAS_FLUXO.length - 1 && (
                      <ArrowRight className="w-5 h-5 text-muted-foreground" />
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5" />
                Tipos de Problema (Categorias Padrão)
              </CardTitle>
              <CardDescription>
                Categorias usadas quando não há categorias customizadas da prefeitura
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3">
                {TIPOS_PROBLEMA.map(tipo => (
                  <div key={tipo.id} className="p-3 bg-muted rounded-lg text-center">
                    <span className="text-2xl mb-1 block">{tipo.numero}️⃣</span>
                    <span className="text-sm font-medium">{tipo.label}</span>
                    <Badge variant="secondary" className="mt-1 text-xs">
                      {tipo.id}
                    </Badge>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Comandos */}
        <TabsContent value="comandos">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <MessageSquare className="w-5 h-5" />
                Comandos Disponíveis
              </CardTitle>
              <CardDescription>
                Comandos que o cidadão pode enviar pelo WhatsApp
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {COMANDOS.map((cmd, index) => (
                  <div key={index} className="flex items-start gap-3 p-3 bg-muted rounded-lg">
                    <code className="bg-background px-2 py-1 rounded text-sm font-mono text-primary whitespace-nowrap">
                      {cmd.comando}
                    </code>
                    <span className="text-sm text-muted-foreground">{cmd.descricao}</span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Respostas Automáticas */}
        <TabsContent value="respostas">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Bot className="w-5 h-5" />
                Respostas Automáticas
              </CardTitle>
              <CardDescription>
                Templates de resposta usados pelo robô em diferentes situações
              </CardDescription>
            </CardHeader>
            <CardContent>
              <ScrollArea className="h-[500px]">
                <div className="space-y-4">
                  {RESPOSTAS_AUTOMATICAS.map((item, index) => (
                    <div key={index} className="border rounded-lg p-4 space-y-2">
                      <div className="flex items-center gap-2">
                        <Badge variant="outline">{item.tipo}</Badge>
                        <span className="text-sm font-medium">Gatilho: {item.gatilho}</span>
                      </div>
                      <pre className="bg-muted p-3 rounded-lg text-sm whitespace-pre-wrap font-sans">
                        {item.resposta}
                      </pre>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Estrutura do Código */}
        <TabsContent value="codigo" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="w-5 h-5" />
                Estrutura do Arquivo
              </CardTitle>
              <CardDescription>
                Localização: supabase/functions/whatsapp-ai-agent/index.ts
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 1-100</Badge>
                    Interfaces e Constantes
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <code>ConversaData</code> - Estrutura da conversa</li>
                    <li>• <code>CidadaoData</code> - Dados do cidadão</li>
                    <li>• <code>ReclamacaoHistorico</code> - Histórico de reclamações</li>
                    <li>• <code>PrefeituraData</code> - Dados da prefeitura</li>
                    <li>• <code>MensagemRecebida</code> - Estrutura da mensagem</li>
                    <li>• <code>ETAPAS_FLUXO</code> - Array com as 6 etapas</li>
                    <li>• <code>TIPOS_PROBLEMA</code> - Categorias padrão</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 100-200</Badge>
                    Funções Auxiliares
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <code>normText()</code> - Normaliza texto (remove acentos, minúsculas)</li>
                    <li>• <code>isPularMidia()</code> - Detecta se quer pular etapa de mídia</li>
                    <li>• <code>isSaudacao()</code> - Detecta saudações</li>
                    <li>• <code>isConfirmacao()</code> - Detecta confirmação</li>
                    <li>• <code>formatQtd()</code> - Formata quantidades (1 foto, 2 fotos)</li>
                    <li>• <code>buildResumoConfirmacao()</code> - Monta resumo para confirmação</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 200-400</Badge>
                    Processamento Inicial
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Conexão Supabase com service_role</li>
                    <li>• Busca cidadão existente pelo telefone</li>
                    <li>• Conta reclamações anteriores</li>
                    <li>• Busca/cria conversa WhatsApp</li>
                    <li>• Atualiza mídias e localização</li>
                    <li>• Busca bairros e categorias da prefeitura</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 400-600</Badge>
                    Comandos Especiais
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• <code>/consultar</code> - Consulta protocolo via RPC</li>
                    <li>• <code>/minhas</code> - Lista reclamações do cidadão</li>
                    <li>• <code>/cancelar</code> - Reseta conversa</li>
                    <li>• Detecção de protocolo no texto</li>
                    <li>• Histórico de movimentações</li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 600-850</Badge>
                    Fluxo de Etapas
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Determina etapa atual baseado nos dados</li>
                    <li>• Trata saudação (novo vs recorrente)</li>
                    <li>• Etapa de mídia (receber, pular, confirmar)</li>
                    <li>• Etapa de confirmação (criar reclamação)</li>
                    <li>• Chama RPC <code>criar_reclamacao_publica</code></li>
                  </ul>
                </div>

                <div className="border rounded-lg p-4">
                  <h4 className="font-medium mb-2 flex items-center gap-2">
                    <Badge>Linhas 850-1200</Badge>
                    IA (Lovable AI)
                  </h4>
                  <ul className="text-sm text-muted-foreground space-y-1 ml-4">
                    <li>• Monta contexto completo para a IA</li>
                    <li>• Envia histórico de mensagens</li>
                    <li>• System prompt com regras detalhadas</li>
                    <li>• Extrai dados do JSON de resposta</li>
                    <li>• Atualiza conversa no banco</li>
                    <li>• Trata mudança de estado</li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <HelpCircle className="w-5 h-5" />
                Estados da Conversa
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {[
                  { estado: 'inicio', desc: 'Aguardando primeira mensagem' },
                  { estado: 'coletando_dados', desc: 'Coletando informações' },
                  { estado: 'aguardando_midia', desc: 'Esperando fotos/vídeos' },
                  { estado: 'confirmando', desc: 'Aguardando confirmação' },
                ].map(item => (
                  <div key={item.estado} className="p-3 bg-muted rounded-lg">
                    <Badge variant="secondary" className="mb-2">{item.estado}</Badge>
                    <p className="text-xs text-muted-foreground">{item.desc}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CheckCircle2 className="w-5 h-5" />
                Integrações Utilizadas
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                {[
                  { nome: 'Supabase', uso: 'Banco de dados e RPC' },
                  { nome: 'Lovable AI', uso: 'Processamento de linguagem natural' },
                  { nome: 'Evolution API', uso: 'Envio/recebimento WhatsApp' },
                  { nome: 'cidadaos', uso: 'Tabela de cidadãos' },
                  { nome: 'reclamacoes', uso: 'Tabela de reclamações' },
                  { nome: 'whatsapp_conversas', uso: 'Estado das conversas' },
                ].map(item => (
                  <div key={item.nome} className="p-3 border rounded-lg">
                    <p className="font-medium text-sm">{item.nome}</p>
                    <p className="text-xs text-muted-foreground">{item.uso}</p>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
};

export default AdminWhatsAppBot;
