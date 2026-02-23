"use client";

import * as React from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DayPicker } from "react-day-picker";

import { cn } from "./utils";
import { buttonVariants } from "./button";
import { haptics } from "../../utils/haptics";

function Calendar({
  className,
  classNames,
  showOutsideDays = true,
  ...props
}: React.ComponentProps<typeof DayPicker>) {
  return (
    <DayPicker
      showOutsideDays={showOutsideDays}
      className={cn("p-3 bg-white dark:bg-[#000000]", className)}
      classNames={{
        months: "flex flex-col sm:flex-row gap-2",
        month: "flex flex-col gap-4",
        caption: "flex justify-center pt-1 relative items-center w-full",
        caption_label: "text-sm font-medium text-gray-900 dark:text-white",
        nav: "flex items-center gap-1",
        nav_button: cn(
          buttonVariants({ variant: "outline" }),
          "size-7 bg-transparent p-0 opacity-50 hover:opacity-100 text-gray-900 dark:text-white border-gray-200 dark:border-white/20",
        ),
        nav_button_previous: "absolute left-1",
        nav_button_next: "absolute right-1",
        table: "w-full border-collapse space-x-1",
        head_row: "flex",
        head_cell:
          "text-gray-600 dark:text-white/70 rounded-md w-8 font-normal text-[0.8rem]",
        row: "flex w-full mt-2",
        cell: cn(
          "relative p-0 text-center text-sm focus-within:relative focus-within:z-20 [&:has([aria-selected])]:bg-transparent [&:has([aria-selected].day-range-end)]:rounded-r-md",
          props.mode === "range"
            ? "[&:has(>.day-range-end)]:rounded-r-md [&:has(>.day-range-start)]:rounded-l-md first:[&:has([aria-selected])]:rounded-l-md last:[&:has([aria-selected])]:rounded-r-md"
            : "[&:has([aria-selected])]:rounded-md",
        ),
        day: cn(
          buttonVariants({ variant: "ghost" }),
          "size-8 p-0 font-normal aria-selected:opacity-100 text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-white/10",
        ),
        day_range_start:
          "day-range-start aria-selected:bg-[#ec1e24] aria-selected:text-white",
        day_range_end:
          "day-range-end aria-selected:bg-[#ec1e24] aria-selected:text-white",
        day_selected:
          "bg-transparent border-2 border-[#ec1e24] text-[#ec1e24] dark:text-[#ec1e24] hover:bg-[#ec1e24]/10 dark:hover:bg-[#ec1e24]/10 focus:bg-[#ec1e24]/10 dark:focus:bg-[#ec1e24]/10",
        day_today: "!bg-gray-100 dark:!bg-black/30 !text-gray-900 dark:!text-white border border-gray-300 dark:border-white/30 hover:!bg-gray-200 dark:hover:!bg-black/40",
        day_outside:
          "day-outside text-gray-400 dark:text-white/40 aria-selected:text-muted-foreground",
        day_disabled: "text-muted-foreground opacity-50",
        day_range_middle:
          "aria-selected:bg-accent aria-selected:text-accent-foreground",
        day_hidden: "invisible",
        ...classNames,
      }}
      components={{
        IconLeft: ({ className, ...props }) => (
          <ChevronLeft className={cn("size-4", className)} {...props} />
        ),
        IconRight: ({ className, ...props }) => (
          <ChevronRight className={cn("size-4", className)} {...props} />
        ),
      }}
      onMonthChange={() => haptics.light()}
      {...props}
    />
  );
}

export { Calendar };