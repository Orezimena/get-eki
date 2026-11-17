import { forwardRef, useState, type ComponentProps } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

type Props = Omit<ComponentProps<"input">, "type" | "id"> & {
  id: string;
  visibilityLabel: string;
};

export const PasswordInput = forwardRef<HTMLInputElement, Props>(function PasswordInput(
  { id, visibilityLabel, className, disabled, onChange, ...props },
  ref,
) {
  const [visible, setVisible] = useState(false);
  return (
    <div className="relative">
      <Input
        {...props}
        ref={ref}
        id={id}
        type={visible ? "text" : "password"}
        disabled={disabled}
        className={cn("h-11 pr-16", className)}
        onChange={(event) => {
          if (!event.currentTarget.value) setVisible(false);
          onChange?.(event);
        }}
      />
      <button
        type="button"
        className="absolute inset-y-0 right-0 rounded-r-md px-3 text-sm font-semibold text-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
        aria-label={`${visible ? "Hide" : "Show"} ${visibilityLabel}`}
        aria-controls={id}
        aria-pressed={visible}
        disabled={disabled}
        onClick={() => setVisible((current) => !current)}
      >
        {visible ? "Hide" : "Show"}
      </button>
    </div>
  );
});
