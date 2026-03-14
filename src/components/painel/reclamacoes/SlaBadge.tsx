import { SlaStatus, slaConfig } from './types';

interface SlaBadgeProps {
  status: SlaStatus;
  dias: number;
}

export const SlaBadge = ({ status, dias }: SlaBadgeProps) => {
  const config = slaConfig[status];
  
  return (
    <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium ${config.bgClass} ${config.color}`}>
      <span>{config.icon}</span>
      <span>{dias}d</span>
    </div>
  );
};
