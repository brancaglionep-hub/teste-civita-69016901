import { forwardRef } from 'react';
import { RefreshCw } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export const RecorrenciaBadge = forwardRef<HTMLSpanElement>((_, ref) => {
  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <span 
            ref={ref}
            className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium bg-purple-100 text-purple-700"
          >
            <RefreshCw className="w-3 h-3" />
            Recorrente
          </span>
        </TooltipTrigger>
        <TooltipContent>
          <p>Problema já reportado nesta rua/categoria nos últimos 90 dias</p>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
});

RecorrenciaBadge.displayName = 'RecorrenciaBadge';
