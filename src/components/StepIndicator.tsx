import { Check } from "lucide-react";

interface StepIndicatorProps {
  currentStep: number;
  totalSteps: number;
  labels: string[];
  onStepClick?: (step: number) => void;
}

const StepIndicator = ({ currentStep, totalSteps, labels, onStepClick }: StepIndicatorProps) => {
  return (
    <div className="w-full px-4 py-6">
      <div className="flex items-center justify-between max-w-md mx-auto">
        {Array.from({ length: totalSteps }, (_, i) => {
          const stepNumber = i + 1;
          const isCompleted = stepNumber < currentStep;
          const isActive = stepNumber === currentStep;
          const isClickable = isCompleted && onStepClick;

          return (
            <div key={i} className="flex items-center">
              <div className="flex flex-col items-center">
                <button
                  type="button"
                  onClick={() => isClickable && onStepClick(stepNumber)}
                  disabled={!isClickable}
                  className={`step-indicator ${
                    isCompleted ? "completed" : isActive ? "active" : "pending"
                  } ${isClickable ? "cursor-pointer hover:scale-110 transition-transform" : ""}`}
                >
                  {isCompleted ? (
                    <Check className="w-5 h-5" />
                  ) : (
                    stepNumber
                  )}
                </button>
                <span
                  className={`text-xs mt-2 text-center max-w-[60px] leading-tight ${
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
                  }`}
                >
                  {labels[i]}
                </span>
              </div>
              {i < totalSteps - 1 && (
                <div
                  className={`h-1 w-8 mx-1 rounded-full transition-colors duration-300 ${
                    isCompleted ? "bg-secondary" : "bg-muted"
                  }`}
                />
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
};

export default StepIndicator;
