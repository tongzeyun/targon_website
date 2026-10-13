"use client";

import { memo } from "react";
import { Label } from "@/components/ui/label";

/** 稳定的表单字段组件 — 使用原生 input 避免失焦，memo 避免不必要的重渲染 */
export const FormField = memo(function FormField({
  label, value, onChange, placeholder, type = "text", className = "",
}: {
  label: string;
  value: string | number;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  className?: string;
}) {
  return (
    <div className={className}>
      <Label className="text-xs text-gray-500 mb-1 block">{label}</Label>
      <input
        type={type}
        value={value ?? ""}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex h-8 w-full rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm transition-colors outline-none placeholder:text-muted-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 disabled:cursor-not-allowed disabled:opacity-50"
      />
    </div>
  );
});
