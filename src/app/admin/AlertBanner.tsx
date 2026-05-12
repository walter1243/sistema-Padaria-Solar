"use client";

export type AlertType = "error" | "success" | "warning" | "info";

type AlertBannerProps = {
  message: string;
  type: AlertType;
  onClose: () => void;
};

const styles: Record<AlertType, { border: string; bg: string; text: string; icon: string }> = {
  error: {
    border: "border-[#c81f2f]",
    bg: "bg-[#c81f2f]/10",
    text: "text-[#ff8c98]",
    icon: "⚠️",
  },
  success: {
    border: "border-[#1a7a52]",
    bg: "bg-[#8fe0b8]/10",
    text: "text-[#8fe0b8]",
    icon: "✅",
  },
  warning: {
    border: "border-[#b07c00]",
    bg: "bg-[#f7b731]/10",
    text: "text-[#f7b731]",
    icon: "🔔",
  },
  info: {
    border: "border-[#2a5099]",
    bg: "bg-[#8db5ff]/10",
    text: "text-[#8db5ff]",
    icon: "ℹ️",
  },
};

export function AlertBanner({ message, type, onClose }: AlertBannerProps) {
  const s = styles[type];
  return (
    <div
      className={`flex items-start gap-3 rounded-xl border ${s.border} ${s.bg} px-4 py-3 mb-4`}
      role="alert"
    >
      <span className="mt-0.5 text-base leading-none">{s.icon}</span>
      <p className={`flex-1 text-sm font-semibold leading-snug ${s.text}`}>{message}</p>
      <button
        type="button"
        onClick={onClose}
        className={`ml-2 text-xs font-bold opacity-60 hover:opacity-100 ${s.text}`}
        aria-label="Fechar alerta"
      >
        ✕
      </button>
    </div>
  );
}
