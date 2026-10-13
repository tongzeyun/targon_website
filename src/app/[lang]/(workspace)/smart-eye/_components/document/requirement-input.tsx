"use client";

import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";

interface RequirementInputProps {
  label?: string;
  placeholder?: string;
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  rows?: number;
}

/** 需求/文字输入组件 */
export function RequirementInput({
  label = "输入需求描述",
  placeholder = "请描述您的具体需求，例如：产品型号TMP-X1，数量2台，含13%增值税，交货期30天...",
  value,
  onChange,
  disabled = false,
  rows = 6,
}: RequirementInputProps) {
  return (
    <div className="space-y-2">
      <Label>{label}</Label>
      <Textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        disabled={disabled}
        className="resize-y min-h-[120px]"
      />
    </div>
  );
}
