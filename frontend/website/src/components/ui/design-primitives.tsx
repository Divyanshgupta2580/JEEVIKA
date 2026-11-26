import type { ReactNode } from "react";
import { AlertTriangle, CheckCircle2, Info, ShieldAlert } from "lucide-react";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "./dialog";

export type StatusTone = "neutral" | "critical" | "emergency" | "warning" | "success" | "info";

const toneClasses: Record<StatusTone, string> = {
  neutral: "bg-slate-100 text-slate-700 border-slate-200",
  critical: "bg-[var(--ds-critical-soft)] text-[var(--ds-critical)] border-red-200",
  emergency: "bg-[var(--ds-emergency-soft)] text-[var(--ds-emergency)] border-red-300",
  warning: "bg-[var(--ds-warning-soft)] text-[var(--ds-warning)] border-amber-200",
  success: "bg-[var(--ds-success-soft)] text-[var(--ds-success)] border-emerald-200",
  info: "bg-[var(--ds-info-soft)] text-[var(--ds-info)] border-blue-200",
};

export function StatusChip({
  tone = "neutral",
  children,
  icon,
}: {
  tone?: StatusTone;
  children: ReactNode;
  icon?: ReactNode;
}) {
  return (
    <span className={`inline-flex min-h-7 items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-bold ${toneClasses[tone]}`}>
      {icon}
      {children}
    </span>
  );
}

export function InlineBanner({
  tone = "info",
  title,
  children,
  animateEntrance = false,
}: {
  tone?: StatusTone;
  title: string;
  children?: ReactNode;
  animateEntrance?: boolean;
}) {
  const Icon = tone === "emergency" || tone === "critical"
    ? AlertTriangle
    : tone === "success"
      ? CheckCircle2
      : tone === "warning"
        ? ShieldAlert
        : Info;
  return (
    <div role={tone === "emergency" || tone === "critical" ? "alert" : "status"} className={`flex items-start gap-3 rounded-xl border p-4 ${toneClasses[tone]}${animateEntrance && tone === "success" ? " jvk-motion-success" : ""}`}>
      <Icon className="mt-0.5 h-5 w-5 shrink-0" aria-hidden="true" />
      <div>
        <p className="text-sm font-bold">{title}</p>
        {children && <div className="mt-1 text-sm">{children}</div>}
      </div>
    </div>
  );
}

export function EmptyState({
  title,
  description,
  action,
}: {
  title: string;
  description: string;
  action?: ReactNode;
}) {
  return (
    <div className="flex min-h-48 flex-col items-center justify-center rounded-xl border border-[var(--ds-border-subtle)] bg-white px-6 py-10 text-center">
      <h3 className="text-base font-bold text-[var(--ds-text-primary)]">{title}</h3>
      <p className="mt-2 max-w-md text-sm text-[var(--ds-text-secondary)]">{description}</p>
      {action && <div className="mt-5">{action}</div>}
    </div>
  );
}

export function Stepper({
  steps,
  current,
}: {
  steps: readonly string[];
  current: number;
}) {
  return (
    <ol className="flex items-center gap-2" aria-label="Progress">
      {steps.map((step, index) => (
        <li key={step} className="flex min-w-0 flex-1 items-center gap-2">
          <span
            className={`grid h-8 w-8 shrink-0 place-items-center rounded-full text-xs font-bold ${
              index < current
                ? "bg-[var(--ds-success)] text-white"
                : index === current
                  ? "bg-[var(--ds-primary)] text-white"
                  : "bg-[var(--ds-surface-subtle)] text-[var(--ds-text-secondary)]"
            }`}
            aria-current={index === current ? "step" : undefined}
          >
            {index + 1}
          </span>
          <span className="hidden min-w-0 truncate text-xs font-semibold text-[var(--ds-text-secondary)] sm:block">{step}</span>
        </li>
      ))}
    </ol>
  );
}

export function ProgressBar({ value, label }: { value: number; label: string }) {
  const clamped = Math.max(0, Math.min(100, value));
  return (
    <div>
      <div className="mb-1 flex justify-between text-xs font-semibold text-[var(--ds-text-secondary)]">
        <span>{label}</span>
        <span>{clamped}%</span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-[var(--ds-surface-subtle)]" role="progressbar" aria-label={label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={clamped}>
        <div className="h-full rounded-full bg-[var(--ds-primary)] transition-[width] duration-200" style={{ width: `${clamped}%` }} />
      </div>
    </div>
  );
}

export function SegmentedControl({
  options,
  value,
  onChange,
  label,
}: {
  options: readonly { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
}) {
  return (
    <div className="inline-flex rounded-lg border border-[var(--ds-border-default)] bg-[var(--ds-surface-subtle)] p-1" role="radiogroup" aria-label={label}>
      {options.map((option) => (
        <button
          type="button"
          role="radio"
          aria-checked={value === option.value}
          key={option.value}
          onClick={() => onChange(option.value)}
          className={`min-h-10 rounded-md px-3 text-sm font-bold ${value === option.value ? "bg-white text-[var(--ds-primary)] shadow-sm" : "text-[var(--ds-text-secondary)]"}`}
        >
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Money({ paise, className = "" }: { paise: number; className?: string }) {
  const safePaise = Number.isSafeInteger(paise) ? paise : 0;
  const rupees = Math.trunc(safePaise / 100);
  const remainder = Math.abs(safePaise % 100).toString().padStart(2, "0");
  return <span className={`font-variant-numeric tabular-nums ${className}`}>₹{rupees}.{remainder}</span>;
}

export function Drawer({
  open,
  title,
  description,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description?: string;
  onClose: () => void;
  children: ReactNode;
}) {
  return (
    <Dialog open={open} onOpenChange={(isOpen) => !isOpen && onClose()}>
      <DialogContent className="!left-auto !right-0 !top-0 !h-dvh !max-h-dvh !w-full !max-w-md !translate-x-0 !translate-y-0 overflow-y-auto rounded-none border-l border-[var(--ds-border-subtle)] bg-white p-6">
        <DialogTitle className="text-xl font-bold text-[var(--ds-text-primary)]">{title}</DialogTitle>
        {description && <DialogDescription className="text-[var(--ds-text-secondary)]">{description}</DialogDescription>}
        <div className="mt-5">{children}</div>
      </DialogContent>
    </Dialog>
  );
}

export function FormField({
  label,
  hint,
  error,
  htmlFor,
  children,
}: {
  label: string;
  hint?: string;
  error?: string;
  htmlFor: string;
  children: ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <label htmlFor={htmlFor} className="text-sm font-bold text-[var(--ds-text-primary)]">{label}</label>
      {children}
      {error
        ? <p id={`${htmlFor}-error`} className="text-xs font-semibold text-[var(--ds-critical)]">{error}</p>
        : hint
          ? <p id={`${htmlFor}-hint`} className="text-xs text-[var(--ds-text-secondary)]">{hint}</p>
          : null}
    </div>
  );
}

export function Slider({
  label,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="block">
      <span className="mb-2 flex items-center justify-between text-sm font-bold text-[var(--ds-text-primary)]">
        <span>{label}</span>
        <output className="tabular-nums">{value}</output>
      </span>
      <input
        type="range"
        value={value}
        min={min}
        max={max}
        step={step}
        onChange={(event) => onChange(Number(event.target.value))}
        className="h-3 w-full accent-[var(--ds-primary)]"
      />
    </label>
  );
}
