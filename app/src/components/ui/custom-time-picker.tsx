"use client";

import * as React from "react";
import { Clock, ChevronUp, ChevronDown } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "./popover";

interface CustomTimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function CustomTimePicker({
  value = "09:00",
  onChange,
  className,
}: CustomTimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  
  // Parse the time value
  const [hours, minutes] = value.split(':').map(Number);
  const [selectedHours, setSelectedHours] = React.useState(hours || 9);
  const [selectedMinutes, setSelectedMinutes] = React.useState(minutes || 0);
  const [period, setPeriod] = React.useState<'AM' | 'PM'>(
    selectedHours >= 12 ? 'PM' : 'AM'
  );

  const display12Hour = selectedHours > 12 ? selectedHours - 12 : selectedHours === 0 ? 12 : selectedHours;

  const handleHourIncrement = () => {
    const newHours = selectedHours === 23 ? 0 : selectedHours + 1;
    setSelectedHours(newHours);
    setPeriod(newHours >= 12 ? 'PM' : 'AM');
  };

  const handleHourDecrement = () => {
    const newHours = selectedHours === 0 ? 23 : selectedHours - 1;
    setSelectedHours(newHours);
    setPeriod(newHours >= 12 ? 'PM' : 'AM');
  };

  const handleMinuteIncrement = () => {
    setSelectedMinutes(selectedMinutes === 59 ? 0 : selectedMinutes + 1);
  };

  const handleMinuteDecrement = () => {
    setSelectedMinutes(selectedMinutes === 0 ? 59 : selectedMinutes - 1);
  };

  const togglePeriod = () => {
    const newPeriod = period === 'AM' ? 'PM' : 'AM';
    setPeriod(newPeriod);
    const newHours = newPeriod === 'PM' 
      ? (selectedHours < 12 ? selectedHours + 12 : selectedHours)
      : (selectedHours >= 12 ? selectedHours - 12 : selectedHours);
    setSelectedHours(newHours);
  };

  const handleSet = () => {
    const timeString = `${String(selectedHours).padStart(2, '0')}:${String(selectedMinutes).padStart(2, '0')}`;
    onChange?.(timeString);
    setIsOpen(false);
  };

  return (
    <Popover open={isOpen} onOpenChange={setIsOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "w-full justify-start text-left font-normal h-10 border-2 !bg-white dark:!bg-[#000000] border-gray-200 dark:border-[#333333]",
            "hover:border-[#ec1e24]/50 hover:!bg-white dark:hover:!bg-[#000000]",
            "focus:border-[#ec1e24] focus:ring-4 focus:ring-[#ec1e24]/10",
            className
          )}
        >
          <Clock className="mr-2 h-4 w-4 text-[#ec1e24]" />
          <span className="text-[#ec1e24]">
            {value || "Pick a time"}
          </span>
        </Button>
      </PopoverTrigger>
      <PopoverContent 
        className="w-auto p-0 !bg-white dark:!bg-[#000000] border-2 border-[#ec1e24] shadow-lg shadow-[#ec1e24]/20" 
        align="start"
        style={{ zIndex: 9999 }}
      >
        <div className="p-6">
          {/* Display */}
          <div className="mb-6 text-center">
            <div className="text-4xl tracking-wider mb-2">
              <span className="text-[#ec1e24] dark:text-[#ec1e24] font-mono">
                {String(display12Hour).padStart(2, '0')}
              </span>
              <span className="text-gray-400 dark:text-[#666666] mx-1">:</span>
              <span className="text-[#ec1e24] dark:text-[#ec1e24] font-mono">
                {String(selectedMinutes).padStart(2, '0')}
              </span>
            </div>
            <div className="text-sm text-gray-600 dark:text-[#999999]">
              {period}
            </div>
          </div>

          {/* Time Picker Controls */}
          <div className="flex items-center justify-center gap-4 mb-6">
            {/* Hours */}
            <div className="flex flex-col items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleHourIncrement}
                className="h-8 w-8 p-0 hover:bg-[#ec1e24]/10 text-[#ec1e24]"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="my-2 w-16 h-16 rounded-lg bg-[#ec1e24]/10 dark:bg-[#ec1e24]/20 flex items-center justify-center border-2 border-[#ec1e24]/30">
                <span className="text-2xl text-[#ec1e24] font-mono">
                  {String(display12Hour).padStart(2, '0')}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleHourDecrement}
                className="h-8 w-8 p-0 hover:bg-[#ec1e24]/10 text-[#ec1e24]"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="text-xs text-gray-600 dark:text-[#999999] mt-2">Hours</div>
            </div>

            <div className="text-3xl text-gray-400 dark:text-[#666666] mb-8">:</div>

            {/* Minutes */}
            <div className="flex flex-col items-center">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMinuteIncrement}
                className="h-8 w-8 p-0 hover:bg-[#ec1e24]/10 text-[#ec1e24]"
              >
                <ChevronUp className="h-4 w-4" />
              </Button>
              <div className="my-2 w-16 h-16 rounded-lg bg-[#ec1e24]/10 dark:bg-[#ec1e24]/20 flex items-center justify-center border-2 border-[#ec1e24]/30">
                <span className="text-2xl text-[#ec1e24] font-mono">
                  {String(selectedMinutes).padStart(2, '0')}
                </span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleMinuteDecrement}
                className="h-8 w-8 p-0 hover:bg-[#ec1e24]/10 text-[#ec1e24]"
              >
                <ChevronDown className="h-4 w-4" />
              </Button>
              <div className="text-xs text-gray-600 dark:text-[#999999] mt-2">Minutes</div>
            </div>

            {/* AM/PM Toggle */}
            <div className="flex flex-col items-center ml-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={togglePeriod}
                className={cn(
                  "h-16 w-12 border-2 mb-8",
                  period === 'AM' 
                    ? "bg-[#ec1e24] text-white border-[#ec1e24] hover:bg-[#d91a1f] hover:text-white" 
                    : "bg-white dark:bg-[#000000] text-[#ec1e24] border-[#ec1e24]/30 hover:border-[#ec1e24] hover:bg-[#ec1e24]/10"
                )}
              >
                AM
              </Button>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={togglePeriod}
                className={cn(
                  "h-16 w-12 border-2",
                  period === 'PM' 
                    ? "bg-[#ec1e24] text-white border-[#ec1e24] hover:bg-[#d91a1f] hover:text-white" 
                    : "bg-white dark:bg-[#000000] text-[#ec1e24] border-[#ec1e24]/30 hover:border-[#ec1e24] hover:bg-[#ec1e24]/10"
                )}
              >
                PM
              </Button>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex gap-2 pt-4 border-t border-gray-200 dark:border-[#333333]">
            <Button
              type="button"
              variant="outline"
              onClick={() => setIsOpen(false)}
              className="flex-1 border-gray-200 dark:border-[#333333] text-gray-700 dark:text-[#999999] hover:bg-gray-100 dark:hover:bg-[#1a1a1a]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleSet}
              className="flex-1 bg-[#ec1e24] hover:bg-[#d91a1f] text-white border-0"
            >
              Set
            </Button>
          </div>
        </div>
      </PopoverContent>
    </Popover>
  );
}
