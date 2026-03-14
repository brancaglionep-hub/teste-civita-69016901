import { CircleOff, Construction, CloudRain, Triangle, Car, AlertTriangle } from "lucide-react";

interface ProblemType {
  id: string;
  label: string;
  icon: React.ReactNode;
}

const problemTypes: ProblemType[] = [
  { id: "buraco", label: "Buraco na rua", icon: <CircleOff className="w-10 h-10 lg:w-12 lg:h-12" /> },
  { id: "danificada", label: "Rua danificada", icon: <Construction className="w-10 h-10 lg:w-12 lg:h-12" /> },
  { id: "alagada", label: "Rua alagada", icon: <CloudRain className="w-10 h-10 lg:w-12 lg:h-12" /> },
  { id: "desnivel", label: "Desnível na pista", icon: <Triangle className="w-10 h-10 lg:w-12 lg:h-12" /> },
  { id: "dificil", label: "Rua difícil de trafegar", icon: <Car className="w-10 h-10 lg:w-12 lg:h-12" /> },
  { id: "outro", label: "Outro problema", icon: <AlertTriangle className="w-10 h-10 lg:w-12 lg:h-12" /> },
];

interface ProblemTypeSelectorProps {
  selected: string;
  onSelect: (id: string) => void;
}

const ProblemTypeSelector = ({ selected, onSelect }: ProblemTypeSelectorProps) => {
  return (
    <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
      {problemTypes.map((problem) => (
        <button
          key={problem.id}
          type="button"
          onClick={() => onSelect(problem.id)}
          className={`card-problem flex flex-col items-center justify-center text-center gap-3 min-h-[130px] lg:min-h-[150px] ${
            selected === problem.id ? "selected" : ""
          }`}
        >
          <div className={`${selected === problem.id ? "text-primary" : "text-muted-foreground"} transition-colors`}>
            {problem.icon}
          </div>
          <span className={`text-sm lg:text-base font-medium leading-tight ${selected === problem.id ? "text-primary" : "text-foreground"}`}>
            {problem.label}
          </span>
        </button>
      ))}
    </div>
  );
};

export default ProblemTypeSelector;
