"use client";

import { useUiText } from "@/app/[lang]/(workspace)/smart-eye/_hooks/use-ui-text";

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
  const uiText = useUiText();
  const normalizedValue = normalizeContactInfluenceLevel(value);
  const [previewValue, setPreviewValue] = useState<number | null>(null);
  const displayedValue = previewValue ?? normalizedValue;
  const accessibleLabel = uiText("影响力：{0} 星，共 {1} 星", { 0: normalizedValue, 1: CONTACT_INFLUENCE_MAX });

  if (readOnly) {
    return (
      <span
        role="img"
        aria-label={accessibleLabel}
        className={cn("inline-flex items-center gap-1", className)}
      >
        {levels.map((level) => (
          level <= normalizedValue ? (
            <img key={level} src="/img/smart-eye/influence-star.svg" alt="" />
          ) : (
            <StarIcon key={level} aria-hidden="true" className="size-4 fill-transparent text-muted-foreground" />
          )
        ))}
      </span>
    );
  }

  return (
    <RadioGroup
      aria-label={uiText("影响力")}
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
            aria-label={uiText("{0} 星", { 0: level })}
            onMouseEnter={() => setPreviewValue(level)}
            onFocus={() => setPreviewValue(level)}
            onBlur={() => setPreviewValue(null)}
            className="flex size-11 cursor-pointer items-center justify-center rounded-md outline-none transition focus-visible:ring-2 focus-visible:ring-[#6FB1FF] focus-visible:ring-offset-2 focus-visible:ring-offset-card"
          >
            {selected ? (
              <img src="/img/smart-eye/influence-star.svg" alt="" />
            ) : (
              <StarIcon aria-hidden="true" className="size-4 fill-transparent text-muted-foreground transition-colors" />
            )}
          </Radio.Root>
        );
      })}
    </RadioGroup>
  );
}
