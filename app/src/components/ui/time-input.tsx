"use client";

import * as React from "react";
import { Clock } from "lucide-react";

import { cn } from "./utils";

interface TimeInputProps {
  time?: string;
  onTimeChange?: (time: string) => void;
  placeholder?: string;
  className?: string;
}

export function TimeInput({
  time,
  onTimeChange,
  placeholder = "Pick a time",
  className,
}: TimeInputProps) {
  return (
    <div className="relative group">
      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#ec1e24] pointer-events-none z-10 transition-all group-hover:scale-110" />
      <input
        type="time"
        value={time || ""}
        onChange={(e) => onTimeChange?.(e.target.value)}
        className={cn(
          "w-full h-10 pl-10 pr-4 rounded-lg border-2 transition-all duration-300",
          "!bg-white dark:!bg-[#000000]",
          "border-gray-200 dark:border-[#333333]",
          "text-[#ec1e24] dark:text-[#ec1e24]",
          "placeholder:text-gray-400 dark:placeholder:text-[#6B7280]",
          "hover:border-[#ec1e24]/50 dark:hover:border-[#ec1e24]/50",
          "focus:outline-none focus:border-[#ec1e24] focus:ring-4 focus:ring-[#ec1e24]/10",
          "disabled:opacity-50 disabled:cursor-not-allowed",
          // Style the calendar picker indicator
          "[&::-webkit-calendar-picker-indicator]:cursor-pointer",
          "[&::-webkit-calendar-picker-indicator]:opacity-60",
          "[&::-webkit-calendar-picker-indicator]:hover:opacity-100",
          "[&::-webkit-calendar-picker-indicator]:transition-opacity",
          "[&::-webkit-calendar-picker-indicator]:w-4",
          "[&::-webkit-calendar-picker-indicator]:h-4",
          "[&::-webkit-calendar-picker-indicator]:p-0",
          // Dark mode calendar picker indicator - make it red
          "dark:[&::-webkit-calendar-picker-indicator]:invert",
          "dark:[&::-webkit-calendar-picker-indicator]:brightness-0",
          "dark:[&::-webkit-calendar-picker-indicator]:saturate-100",
          "dark:[&::-webkit-calendar-picker-indicator]:hue-rotate-[345deg]",
          className
        )}
        placeholder={placeholder}
      />
    </div>
  );
}