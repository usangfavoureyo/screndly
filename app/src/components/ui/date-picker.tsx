"use client";

import * as React from "react";
import { CalendarIcon } from "lucide-react";
import { format } from "date-fns";

import { cn } from "./utils";
import { Button } from "./button";
import { Calendar } from "./calendar";
import { 
  BottomSheet, 
  BottomSheetHeader, 
  BottomSheetTitle, 
  BottomSheetBody, 
  BottomSheetFooter 
} from "./bottom-sheet";
import { haptics } from "../../utils/haptics";

interface DatePickerProps {
  date?: Date;
  onDateChange?: (date: Date | undefined) => void;
  onOpenChange?: (open: boolean) => void;
  placeholder?: string;
  className?: string;
}

export function DatePicker({
  date,
  onDateChange,
  onOpenChange,
  placeholder = "Pick a date",
  className,
}: DatePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [tempDate, setTempDate] = React.useState<Date | undefined>(date);

  React.useEffect(() => {
    onOpenChange?.(isOpen);
  }, [isOpen, onOpenChange]);

  React.useEffect(() => {
    setTempDate(date);
  }, [date]);

  const handleDateSelect = (selectedDate: Date | undefined) => {
    haptics.light();
    setTempDate(selectedDate);
  };

  const handleDone = () => {
    haptics.light();
    onDateChange?.(tempDate);
    setIsOpen(false);
  };

  const handleCancel = () => {
    haptics.light();
    setTempDate(date);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant={"outline"}
        onClick={() => {
          haptics.light();
          setIsOpen(true);
        }}
        className={cn(
          "w-full justify-start text-left font-normal !bg-white dark:!bg-[#000000] border-gray-200 dark:border-[#333333]",
          !date && "text-muted-foreground",
          className
        )}
      >
        <CalendarIcon className="mr-2 h-4 w-4 text-[#ec1e24]" />
        {date ? (
          <span className="text-black dark:text-white">
            {format(date, "EEE dd MMM yyyy")}
          </span>
        ) : (
          <span>{placeholder}</span>
        )}
      </Button>

      <BottomSheet open={isOpen} onOpenChange={setIsOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Select Date</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="flex justify-center py-4">
            <Calendar
              mode="single"
              selected={tempDate}
              onSelect={handleDateSelect}
              initialFocus
              className="rounded-md border-0"
            />
          </div>
        </BottomSheetBody>
        <BottomSheetFooter>
          <div className="flex gap-3 w-full">
            <Button
              variant="outline"
              onClick={handleCancel}
              className="flex-1 !bg-white dark:!bg-[#000000] !text-gray-900 dark:!text-white border-gray-300 dark:border-[#333333]"
            >
              Cancel
            </Button>
            <Button
              onClick={handleDone}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d11a1f] text-white"
            >
              Done
            </Button>
          </div>
        </BottomSheetFooter>
      </BottomSheet>
    </>
  );
}
