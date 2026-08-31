import * as React from "react";
import { cn } from "./cn";

export interface TextAreaProps extends React.TextareaHTMLAttributes<HTMLTextAreaElement> {
  label?: string;
  error?: string;
}

export const TextArea = React.forwardRef<HTMLTextAreaElement, TextAreaProps>(function TextArea(
  { label, error, className, id, ...rest },
  ref,
) {
  const generatedId = React.useId();
  const areaId = id ?? generatedId;
  return (
    <div className="w-full">
      {label && (
        <label htmlFor={areaId} className="mb-1.5 block text-[13px] font-medium text-ink-soft">
          {label}
        </label>
      )}
      <textarea
        ref={ref}
        id={areaId}
        aria-invalid={error ? true : undefined}
        className={cn(
          "w-full resize-none rounded-xl border bg-white px-3.5 py-3 text-[15px] leading-relaxed text-ink",
          "placeholder:text-ink-faint transition-shadow focus:shadow-focus focus:outline-none",
          error ? "border-signal-risk/50" : "border-line-strong focus:border-brand-400",
          className,
        )}
        {...rest}
      />
      {error && <p className="mt-1.5 text-[13px] text-signal-risk">{error}</p>}
    </div>
  );
});
