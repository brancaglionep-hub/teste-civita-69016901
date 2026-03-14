import { Search, Filter, Clock, Tag, AlertTriangle } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { SlaStatus } from './types';

interface Categoria {
  id: string;
  nome: string;
}

interface FiltrosAvancadosProps {
  search: string;
  onSearchChange: (value: string) => void;
  statusFilter: string;
  onStatusFilterChange: (value: string) => void;
  tempoFilter: string;
  onTempoFilterChange: (value: string) => void;
  slaFilter: string;
  onSlaFilterChange: (value: string) => void;
  categoriaFilter: string;
  onCategoriaFilterChange: (value: string) => void;
  categorias: Categoria[];
  onExport: () => void;
}

export const FiltrosAvancados = ({
  search,
  onSearchChange,
  statusFilter,
  onStatusFilterChange,
  tempoFilter,
  onTempoFilterChange,
  slaFilter,
  onSlaFilterChange,
  categoriaFilter,
  onCategoriaFilterChange,
  categorias,
  onExport,
}: FiltrosAvancadosProps) => {
  return (
    <div className="space-y-4">
      {/* Linha 1: Busca e filtros principais */}
      <div className="flex flex-col lg:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-muted-foreground" />
          <Input
            placeholder="Buscar por protocolo, rua ou bairro..."
            value={search}
            onChange={(e) => onSearchChange(e.target.value)}
            className="pl-10"
          />
        </div>

        <Select value={statusFilter} onValueChange={onStatusFilterChange}>
          <SelectTrigger className="w-full lg:w-40">
            <Filter className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="recebida">Recebidas</SelectItem>
            <SelectItem value="em_analise">Em Análise</SelectItem>
            <SelectItem value="em_andamento">Em Andamento</SelectItem>
            <SelectItem value="resolvida">Resolvidas</SelectItem>
            <SelectItem value="arquivada">Arquivadas</SelectItem>
          </SelectContent>
        </Select>

        <Select value={slaFilter} onValueChange={onSlaFilterChange}>
          <SelectTrigger className="w-full lg:w-40">
            <AlertTriangle className="w-4 h-4 mr-2" />
            <SelectValue placeholder="SLA" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos SLA</SelectItem>
            <SelectItem value="vencido">🔴 Vencidos</SelectItem>
            <SelectItem value="proximo">🟡 Próximos</SelectItem>
            <SelectItem value="dentro">🟢 No prazo</SelectItem>
          </SelectContent>
        </Select>

        <Select value={categoriaFilter} onValueChange={onCategoriaFilterChange}>
          <SelectTrigger className="w-full lg:w-44">
            <Tag className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Categoria" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todas categorias</SelectItem>
            {categorias.map((cat) => (
              <SelectItem key={cat.id} value={cat.id}>
                {cat.nome}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <Select value={tempoFilter} onValueChange={onTempoFilterChange}>
          <SelectTrigger className="w-full lg:w-36">
            <Clock className="w-4 h-4 mr-2" />
            <SelectValue placeholder="Tempo" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Qualquer tempo</SelectItem>
            <SelectItem value="hoje">Hoje</SelectItem>
            <SelectItem value="1-3">1-3 dias</SelectItem>
            <SelectItem value="4-7">4-7 dias</SelectItem>
            <SelectItem value="8-15">8-15 dias</SelectItem>
            <SelectItem value="16-30">16-30 dias</SelectItem>
            <SelectItem value="30+">Mais de 30 dias</SelectItem>
          </SelectContent>
        </Select>
      </div>
    </div>
  );
};
