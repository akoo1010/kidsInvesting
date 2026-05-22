import { AVAILABLE_EMOJIS } from "@/lib/portfolio";

type AvatarPickerProps = {
  value: string;
  onChange: (emoji: string) => void;
  ariaLabel?: string;
  size?: "sm" | "md";
};

export function AvatarPicker({
  value,
  onChange,
  ariaLabel = "Avatar",
  size = "sm",
}: AvatarPickerProps) {
  const btnSize = size === "md" ? "h-11 w-11 text-2xl" : "h-10 w-10 text-xl";

  return (
    <div className="flex flex-wrap gap-2" role="radiogroup" aria-label={ariaLabel}>
      {AVAILABLE_EMOJIS.map((e) => (
        <button
          key={e}
          type="button"
          role="radio"
          aria-checked={value === e}
          aria-label={`Avatar ${e}`}
          onClick={() => onChange(e)}
          className={`rounded-xl flex items-center justify-center border transition-colors ${btnSize} ${
            value === e
              ? "border-indigo-600 bg-indigo-50"
              : "border-slate-200 hover:bg-slate-50"
          }`}
        >
          {e}
        </button>
      ))}
    </div>
  );
}
