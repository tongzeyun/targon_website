"use client";

import { useState } from "react";
import { Radio } from "@base-ui/react/radio";
import { RadioGroup } from "@base-ui/react/radio-group";
import { StarIcon } from "lucide-react";
import {
  CONTACT_INFLUENCE_MAX,
  CONTACT_INFLUENCE_MIN,
  normalizeContactInfluenceLevel,
} from "@/lib/contact-influence";
import { cn } from "@/lib/utils";

const levels = Array.from(
  { length: CONTACT_INFLUENCE_MAX - CONTACT_INFLUENCE_MIN + 1 },
  (_, index) => index + CONTACT_INFLUENCE_MIN,
);

type InfluenceRatingProps = {
  value?: number | null;
  onValueChange?: (value: number) => void;
  readOnly?: boolean;
  className?: string;
};

export function InfluenceRating({
  value,
  onValueChange,
  readOnly = false,
  className,
}: InfluenceRatingProps) {
  const normalizedValue = normalizeContactInfluenceLevel(value);
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const displayedValue = previewValue ?? normalizedValue;
  const accessibleLabel = `影响力：${normalizedValue} 星，共 ${CONTACT_INFLUENCE_MAX} 星`;

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={accessibleLabel}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {levels.map((level) => (
          <StarIcon
            key={level}
            aria-hidden="true"
            className={cn(
              "size-5",
              level <= normalizedValue ? "fill-[#F8C65C] text-[#F8C65C]" : "fill-transparent text-[#50596A]",
            )}
          />
        ))}
      </span>
    );
  }

  return (
    <RadioGroup
      aria-label="影响力"
      value={normalizedValue}
      onValueChange={(nextValue) => onValueChange?.(normalizeContactInfluenceLevel(nextValue))}
      onMouseLeave={() => setPreviewValue(null)}
      className={cn("flex w-fit items-center", className)}
    >
      {levels.map((level) => {
        const selected = level <= displayedValue;

        return (
          <Radio.Root
            key={level}
            value={level}
            aria-label={`${level} 星`}
            onMouseEnter={() => setPreviewValue(level)}
            onFocus={() => setPreviewValue(level)}
            onBlur={() => setPreviewValue(null)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-[#6FB1FF] focus-visible:ring-offset-2 focus-visible:ring-offset-[#11161F]"
          >
            <StarIcon
              aria-hidden="true"
              className={cn(
                "size-7 transition-colors",
                selected ? "fill-[#F8C65C] text-[#F8C65C]" : "fill-transparent text-[#50596A]",
              )}
            />
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}
