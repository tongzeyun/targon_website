"use client";

import { useState, type ChangeEvent } from "react";
import { CalendarDays, Clock3 } from "lucide-react";
import { DayPicker, type ClassNames, type DropdownProps } from "react-day-picker";
import { zhCN } from "react-day-picker/locale";

import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  formatDateLabel,
  formatDateTimeValue,
  formatDateValue,
  parseDateTimeValue,
  parseDateValue,
} from "@/lib/date-values";

const calendarClassNames: Partial<ClassNames> = {
  root: "relative select-none",
  months: "flex flex-col",
  month: "space-y-3",
  month_caption: "flex h-9 items-center justify-center",
  dropdowns: "relative z-10 flex items-center justify-center gap-2",
  nav: "pointer-events-none absolute inset-x-0 top-0 flex h-9 items-center justify-between",
  button_previous: "pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-[#A4ADBD] transition hover:bg-[#202837] hover:text-white disabled:opacity-40",
  button_next: "pointer-events-auto inline-flex size-8 items-center justify-center rounded-md text-[#A4ADBD] transition hover:bg-[#202837] hover:text-white disabled:opacity-40",
  chevron: "size-4 fill-current text-[#A4ADBD]",
  month_grid: "w-full border-collapse",
  weekdays: "flex",
  weekday: "w-9 py-1 text-center text-xs font-normal text-[#687286]",
  weeks: "block",
  week: "mt-1 flex w-full",
  day: "relative size-9 p-0 text-center text-sm",
  day_button: "inline-flex size-9 items-center justify-center rounded-md text-[#C7CEDA] outline-none transition hover:bg-[#202837] hover:text-white focus-visible:ring-2 focus-visible:ring-[#6FB1FF]/60",
  selected: "[&>button]:bg-[#6EA9F4] [&>button]:font-semibold [&>button]:text-[#07101D] [&>button]:hover:bg-[#82B7FA]",
  today: "[&>button]:ring-1 [&>button]:ring-[#6FB1FF]/60",
  outside: "[&>button]:text-[#465064]",
  disabled: "[&>button]:cursor-not-allowed [&>button]:opacity-30",
  hidden: "invisible",
};

const selectContentClassName =
  "border border-[#334158] bg-[#111722] text-[#F2F4F8] shadow-2xl ring-0";
const selectItemClassName =
  "px-2 py-1.5 text-[#C7CEDA] [--accent-foreground:#F2F4F8] focus:bg-[#263247] focus:text-[#F2F4F8]";
const hourOptions = Array.from({ length: 24 }, (_, value) => ({
  value: String(value),
  label: `${String(value).padStart(2, "0")} 时`,
}));
const minuteOptions = Array.from({ length: 60 }, (_, value) => ({
  value: String(value),
  label: `${String(value).padStart(2, "0")} 分`,
}));

const triggerBaseClassName =
  "flex h-10 w-full min-w-0 items-center justify-between gap-2 rounded-[8px] border border-[#334158] bg-[#080D16] px-3 text-left text-sm text-[#F2F4F8] outline-none transition hover:border-[#465A78] focus-visible:border-[#6FB1FF] focus-visible:ring-3 focus-visible:ring-[#6FB1FF]/15 disabled:cursor-not-allowed disabled:opacity-50";

interface DatePickerProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  className?: string;
  disabled?: boolean;
  legacyHint?: string;
}

function CalendarDropdown({
  options = [],
  value,
  onChange,
  disabled,
  "aria-label": ariaLabel,
}: DropdownProps) {
  const selectedValue = String(value ?? "");
  const items = options.map((option) => ({
    value: String(option.value),
    label: option.label,
  }));

  const handleValueChange = (nextValue: string | null) => {
    if (nextValue === null) return;

    // react-day-picker exposes a native-select change handler for custom dropdowns.
    onChange?.({ target: { value: nextValue } } as ChangeEvent<HTMLSelectElement>);
  };

  return (
    <Select
      items={items}
      value={selectedValue}
      onValueChange={handleValueChange}
      disabled={disabled}
      modal={false}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-8 min-w-[76px] rounded-md border-[#334158] bg-[#080D16] px-2 text-[#F2F4F8] hover:border-[#465A78] focus-visible:border-[#6FB1FF] focus-visible:ring-[#6FB1FF]/15"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className={cn("min-w-[92px]", selectContentClassName)}
      >
        {options.map((option) => (
          <SelectItem
            key={option.value}
            value={String(option.value)}
            disabled={option.disabled}
            className={selectItemClassName}
          >
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function TimeSelect({
  value,
  onChange,
  options,
  ariaLabel,
}: {
  value: number;
  onChange: (value: number) => void;
  options: Array<{ value: string; label: string }>;
  ariaLabel: string;
}) {
  return (
    <Select
      items={options}
      value={String(value)}
      onValueChange={(nextValue) => {
        if (nextValue !== null) onChange(Number(nextValue));
      }}
      modal={false}
    >
      <SelectTrigger
        aria-label={ariaLabel}
        className="h-9 min-w-[74px] rounded-md border-[#334158] bg-[#080D16] px-2 text-[#F2F4F8] hover:border-[#465A78] focus-visible:border-[#6FB1FF] focus-visible:ring-[#6FB1FF]/15"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent
        align="start"
        alignItemWithTrigger={false}
        className={cn("min-w-[88px]", selectContentClassName)}
      >
        {options.map((option) => (
          <SelectItem key={option.value} value={option.value} className={selectItemClassName}>
            {option.label}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function CalendarPanel({
  selected,
  onSelect,
}: {
  selected: Date | null;
  onSelect: (date: Date) => void;
}) {
  return (
    <DayPicker
      mode="single"
      selected={selected ?? undefined}
      defaultMonth={selected ?? new Date()}
      onSelect={(date) => {
        if (date) onSelect(date);
      }}
      locale={zhCN}
      captionLayout="dropdown"
      startMonth={new Date(2000, 0)}
      endMonth={new Date(2100, 11)}
      showOutsideDays
      classNames={calendarClassNames}
      components={{ Dropdown: CalendarDropdown }}
    />
  );
}

export function DatePicker({
  value,
  onChange,
  placeholder = "选择日期",
  className,
  disabled,
  legacyHint = "当前值不是具体日期，请重新选择",
}: DatePickerProps) {
  const [open, setOpen] = useState(false);
  const selected = parseDateValue(value);
  const hasLegacyValue = Boolean(value && !selected);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(triggerBaseClassName, className)}
        aria-label={value ? `当前日期：${value}` : placeholder}
      >
        <span className={cn("truncate", !value && "text-[#707B8E]", hasLegacyValue && "text-[#F6BE5B]")}>
          {selected ? formatDateLabel(selected) : value || placeholder}
        </span>
        <CalendarDays className="size-4 shrink-0 text-[#8AB7FF]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border border-[#253048] bg-[#111722] p-3 text-slate-100 shadow-2xl"
      >
        {hasLegacyValue && (
          <p className="mb-1 max-w-64 rounded-md bg-[#302711] px-2.5 py-2 text-xs text-[#F6BE5B]">
            {legacyHint}：{value}
          </p>
        )}
        <CalendarPanel
          selected={selected}
          onSelect={(date) => {
            onChange(formatDateValue(date));
            setOpen(false);
          }}
        />
        <div className="flex items-center justify-between border-t border-[#253048] pt-2">
          <button
            type="button"
            onClick={() => {
              onChange(formatDateValue(new Date()));
              setOpen(false);
            }}
            className="rounded-md px-2.5 py-1.5 text-xs text-[#8AB7FF] transition hover:bg-[#202837]"
          >
            今天
          </button>
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="rounded-md px-2.5 py-1.5 text-xs text-[#A4ADBD] transition hover:bg-[#202837] hover:text-white"
          >
            清空
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface DateTimePickerProps extends Omit<DatePickerProps, "legacyHint"> {
  legacyHint?: string;
}

export function DateTimePicker({
  value,
  onChange,
  placeholder = "选择日期和时间",
  className,
  disabled,
  legacyHint = "当前值不是标准日期时间，重新选择后将替换原值",
}: DateTimePickerProps) {
  const parsed = parseDateTimeValue(value);
  const [open, setOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<Date | null>(parsed?.date ?? null);
  const [hour, setHour] = useState(parsed?.hour ?? 0);
  const [minute, setMinute] = useState(parsed?.minute ?? 0);
  const hasLegacyValue = Boolean(value && !parsed);

  const handleOpenChange = (nextOpen: boolean) => {
    if (nextOpen) {
      const current = parseDateTimeValue(value);
      setDraftDate(current?.date ?? parseDateValue(value));
      setHour(current?.hour ?? 0);
      setMinute(current?.minute ?? 0);
    }
    setOpen(nextOpen);
  };

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger
        type="button"
        disabled={disabled}
        className={cn(triggerBaseClassName, className)}
        aria-label={value ? `当前日期时间：${value}` : placeholder}
      >
        <span className={cn("truncate", !value && "text-[#707B8E]", hasLegacyValue && "text-[#F6BE5B]")}>
          {parsed ? `${formatDateLabel(parsed.date)} ${String(parsed.hour).padStart(2, "0")}:${String(parsed.minute).padStart(2, "0")}` : value || placeholder}
        </span>
        <Clock3 className="size-4 shrink-0 text-[#8AB7FF]" aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent
        align="start"
        className="w-auto border border-[#253048] bg-[#111722] p-3 text-slate-100 shadow-2xl"
      >
        {hasLegacyValue && (
          <p className="mb-1 max-w-72 rounded-md bg-[#302711] px-2.5 py-2 text-xs text-[#F6BE5B]">
            {legacyHint}：{value}
          </p>
        )}
        <CalendarPanel selected={draftDate} onSelect={setDraftDate} />
        <div className="flex items-center gap-2 border-t border-[#253048] pt-3">
          <Clock3 className="size-4 text-[#8AB7FF]" aria-hidden="true" />
          <TimeSelect
            value={hour}
            onChange={setHour}
            options={hourOptions}
            ariaLabel="小时"
          />
          <span className="text-[#687286]">:</span>
          <TimeSelect
            value={minute}
            onChange={setMinute}
            options={minuteOptions}
            ariaLabel="分钟"
          />
        </div>
        <div className="mt-2 flex items-center justify-between">
          <button
            type="button"
            onClick={() => {
              onChange("");
              setOpen(false);
            }}
            className="rounded-md px-2.5 py-1.5 text-xs text-[#A4ADBD] transition hover:bg-[#202837] hover:text-white"
          >
            清空
          </button>
          <button
            type="button"
            disabled={!draftDate}
            onClick={() => {
              if (!draftDate) return;
              onChange(formatDateTimeValue(draftDate, hour, minute));
              setOpen(false);
            }}
            className="rounded-md bg-[#6EA9F4] px-3 py-1.5 text-xs font-semibold text-[#07101D] transition hover:bg-[#82B7FA] disabled:cursor-not-allowed disabled:opacity-50"
          >
            确定
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
