"use client";

import * as React from "react";
import { Clock } from "lucide-react";
import { cn } from "./utils";
import { Button } from "./button";
import {
  BottomSheet,
  BottomSheetHeader,
  BottomSheetTitle,
  BottomSheetBody,
  BottomSheetFooter
} from "./bottom-sheet";
import { haptics } from "../../utils/haptics";

interface TimePickerProps {
  value?: string;
  onChange?: (value: string) => void;
  className?: string;
}

export function TimePicker({
  value = "09:00",
  onChange,
  className,
}: TimePickerProps) {
  const [isOpen, setIsOpen] = React.useState(false);
  const [renderKey, setRenderKey] = React.useState(0);

  const hoursRef = React.useRef<HTMLDivElement>(null);
  const minutesRef = React.useRef<HTMLDivElement>(null);
  const periodRef = React.useRef<HTMLDivElement>(null);

  const scrollTimeoutRef = React.useRef<NodeJS.Timeout | null>(null);
  const lastHapticTimeRef = React.useRef<number>(0);

  // Refs to track current values for haptic gating (only fire on actual changes)
  const currentHoursRef = React.useRef<number>(0);
  const currentMinutesRef = React.useRef<number>(0);
  const currentPeriodRef = React.useRef<'AM' | 'PM'>('AM');

  // Track dragging state for snap-on-release
  const isDraggingRef = React.useRef(false);

  // Generate hours (1-12)
  const hoursList = Array.from({ length: 12 }, (_, i) => i + 1);

  // Generate minutes (0-59)
  const minutesList = Array.from({ length: 60 }, (_, i) => i);

  const periods: ('AM' | 'PM')[] = ['AM', 'PM'];

  // Parse the time value (24-hour format) and convert to 12-hour
  const parseTime = (timeValue: string) => {
    const [hours24, minutes24] = timeValue.split(':').map(Number);
    const period = hours24 >= 12 ? 'PM' : 'AM';
    const hours12 = hours24 > 12 ? hours24 - 12 : hours24 === 0 ? 12 : hours24;
    return { hours12, minutes24: minutes24 || 0, period };
  };

  const { hours12, minutes24, period } = parseTime(value);

  const [selectedHours, setSelectedHours] = React.useState(hours12);
  const [selectedMinutes, setSelectedMinutes] = React.useState(minutes24);
  const [selectedPeriod, setSelectedPeriod] = React.useState<'AM' | 'PM'>(period);

  // Sync state when value prop changes
  React.useEffect(() => {
    const parsed = parseTime(value);
    setSelectedHours(parsed.hours12);
    setSelectedMinutes(parsed.minutes24);
    setSelectedPeriod(parsed.period);
  }, [value]);

  const handleHourChange = (hour: number) => {
    haptics.light();
    setSelectedHours(hour);
  };

  const handleMinuteChange = (minute: number) => {
    haptics.light();
    setSelectedMinutes(minute);
  };

  const handlePeriodChange = (period: 'AM' | 'PM') => {
    haptics.light();
    setSelectedPeriod(period);
  };

  const updateTime = (hours: number, minutes: number, period: 'AM' | 'PM') => {
    // Convert to 24-hour format
    let hours24 = hours;
    if (period === 'PM' && hours !== 12) {
      hours24 = hours + 12;
    } else if (period === 'AM' && hours === 12) {
      hours24 = 0;
    }

    const timeString = `${String(hours24).padStart(2, '0')}:${String(minutes).padStart(2, '0')}`;
    onChange?.(timeString);
  };

  const scrollToCenter = (ref: HTMLDivElement | null, index: number) => {
    if (!ref) return;
    const itemHeight = 44; // Height of each item
    const scrollPosition = index * itemHeight;
    ref.scrollTop = scrollPosition;
  };

  // Snap to nearest item - called ONLY on pointer release
  const snapToNearest = (
    ref: HTMLDivElement | null,
    items: any[],
    setter: (val: any) => void
  ) => {
    if (!ref) return;
    const itemHeight = 44;
    const scrollTop = ref.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    ref.scrollTo({
      top: clampedIndex * itemHeight,
      behavior: 'smooth'
    });

    // Lock selection AFTER snap
    setter(items[clampedIndex]);
  };

  const handleScroll = (
    ref: HTMLDivElement,
    items: (number | 'AM' | 'PM')[],
    setter: (val: any) => void,
    column: 'hours' | 'minutes' | 'period'
  ) => {
    // Update selection in real-time as user scrolls
    const itemHeight = 44;
    const scrollTop = ref.scrollTop;
    const index = Math.round(scrollTop / itemHeight);
    const clampedIndex = Math.max(0, Math.min(index, items.length - 1));

    const selectedValue = items[clampedIndex];

    // Gate haptics to actual value changes only (not every scroll event)
    let valueChanged = false;
    if (column === 'hours' && selectedValue !== currentHoursRef.current) {
      currentHoursRef.current = selectedValue as number;
      valueChanged = true;
    } else if (column === 'minutes' && selectedValue !== currentMinutesRef.current) {
      currentMinutesRef.current = selectedValue as number;
      valueChanged = true;
    } else if (column === 'period' && selectedValue !== currentPeriodRef.current) {
      currentPeriodRef.current = selectedValue as ('AM' | 'PM');
      valueChanged = true;
    }

    if (valueChanged) {
      haptics.light();
    }

    setter(selectedValue);

    // NO SNAP LOGIC - scroll stops when finger stops
    // Removed programmatic scrollTo that was causing feedback loop
  };

  React.useEffect(() => {
    const hoursEl = hoursRef.current;
    const minutesEl = minutesRef.current;
    const periodEl = periodRef.current;

    if (!hoursEl || !minutesEl || !periodEl) return;

    const hoursScrollHandler = () => handleScroll(hoursEl, hoursList, setSelectedHours, 'hours');
    const minutesScrollHandler = () => handleScroll(minutesEl, minutesList, setSelectedMinutes, 'minutes');
    const periodScrollHandler = () => handleScroll(periodEl, periods, setSelectedPeriod, 'period');

    hoursEl.addEventListener('scroll', hoursScrollHandler, { passive: true });
    minutesEl.addEventListener('scroll', minutesScrollHandler, { passive: true });
    periodEl.addEventListener('scroll', periodScrollHandler, { passive: true });

    // Snap-on-release handlers for each column
    const handlePointerDown = () => {
      isDraggingRef.current = true;
    };

    const createReleaseHandler = (
      ref: HTMLDivElement,
      items: any[],
      setter: (val: any) => void
    ) => () => {
      if (isDraggingRef.current) {
        isDraggingRef.current = false;
        snapToNearest(ref, items, setter);
      }
    };

    const hoursRelease = createReleaseHandler(hoursEl, hoursList, setSelectedHours);
    const minutesRelease = createReleaseHandler(minutesEl, minutesList, setSelectedMinutes);
    const periodRelease = createReleaseHandler(periodEl, periods, setSelectedPeriod);

    // Attach pointer/touch events for snap-on-release
    [hoursEl, minutesEl, periodEl].forEach(el => {
      el.addEventListener('pointerdown', handlePointerDown);
    });

    hoursEl.addEventListener('pointerup', hoursRelease);
    hoursEl.addEventListener('pointercancel', hoursRelease);
    hoursEl.addEventListener('touchend', hoursRelease);

    minutesEl.addEventListener('pointerup', minutesRelease);
    minutesEl.addEventListener('pointercancel', minutesRelease);
    minutesEl.addEventListener('touchend', minutesRelease);

    periodEl.addEventListener('pointerup', periodRelease);
    periodEl.addEventListener('pointercancel', periodRelease);
    periodEl.addEventListener('touchend', periodRelease);

    return () => {
      hoursEl.removeEventListener('scroll', hoursScrollHandler);
      minutesEl.removeEventListener('scroll', minutesScrollHandler);
      periodEl.removeEventListener('scroll', periodScrollHandler);

      [hoursEl, minutesEl, periodEl].forEach(el => {
        el.removeEventListener('pointerdown', handlePointerDown);
      });

      hoursEl.removeEventListener('pointerup', hoursRelease);
      hoursEl.removeEventListener('pointercancel', hoursRelease);
      hoursEl.removeEventListener('touchend', hoursRelease);

      minutesEl.removeEventListener('pointerup', minutesRelease);
      minutesEl.removeEventListener('pointercancel', minutesRelease);
      minutesEl.removeEventListener('touchend', minutesRelease);

      periodEl.removeEventListener('pointerup', periodRelease);
      periodEl.removeEventListener('pointercancel', periodRelease);
      periodEl.removeEventListener('touchend', periodRelease);

      if (scrollTimeoutRef.current) {
        clearTimeout(scrollTimeoutRef.current);
      }
    };
  }, [hoursList, minutesList, periods]);

  React.useEffect(() => {
    if (!isOpen) return;

    // Only scroll to center when picker opens, NOT on value changes
    requestAnimationFrame(() => {
      scrollToCenter(hoursRef.current, selectedHours - 1);
      scrollToCenter(minutesRef.current, selectedMinutes);
      scrollToCenter(periodRef.current, selectedPeriod === 'AM' ? 0 : 1);
    });
     
  }, [isOpen]);

  const formatDisplayTime = () => {
    return `${String(selectedHours).padStart(2, '0')}:${String(selectedMinutes).padStart(2, '0')} ${selectedPeriod}`;
  };

  const handleDone = () => {
    haptics.light();
    updateTime(selectedHours, selectedMinutes, selectedPeriod);
    setIsOpen(false);
  };

  const handleCancel = () => {
    haptics.light();
    const parsed = parseTime(value);
    setSelectedHours(parsed.hours12);
    setSelectedMinutes(parsed.minutes24);
    setSelectedPeriod(parsed.period);
    setIsOpen(false);
  };

  return (
    <>
      <Button
        variant="outline"
        onClick={() => {
          haptics.light();
          setIsOpen(true);
        }}
        className={cn(
          "w-full justify-start text-left font-normal !bg-white dark:!bg-[#000000] border-gray-200 dark:border-[#333333]",
          "hover:bg-white dark:hover:bg-[#000000]",
          className
        )}
      >
        <Clock className="mr-2 h-4 w-4 text-[#ec1e24]" />
        <span className="text-black dark:text-white">
          {formatDisplayTime()}
        </span>
      </Button>

      <BottomSheet open={isOpen} onOpenChange={setIsOpen}>
        <BottomSheetHeader>
          <BottomSheetTitle>Select Time</BottomSheetTitle>
        </BottomSheetHeader>
        <BottomSheetBody>
          <div className="flex relative py-3">
            {/* Selection highlight bar */}
            <div className="absolute left-0 right-0 top-1/2 -translate-y-1/2 h-[44px] bg-transparent border-t-2 border-b-2 border-black dark:border-white pointer-events-none z-0" />

            {/* Hours Column */}
            <div className="flex-1 relative z-10">
              <div
                ref={hoursRef}
                className="h-[220px] overflow-y-scroll scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  overscrollBehavior: 'contain'
                }}
              >
                <div className="py-[88px]">
                  {hoursList.map((hour) => {
                    const isSelected = selectedHours === hour;
                    return (
                      <button
                        key={hour}

                        className={cn(
                          "w-full h-[44px] flex items-center justify-center text-lg relative z-10",
                          isSelected
                            ? "text-black dark:text-white font-bold"
                            : "text-black/30 dark:text-white/30 font-normal"
                        )}
                        style={{ lineHeight: '44px' }}
                      >
                        {hour}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Minutes Column */}
            <div className="flex-1 relative z-10">
              <div
                ref={minutesRef}
                className="h-[220px] overflow-y-scroll scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  overscrollBehavior: 'contain'
                }}
              >
                <div className="py-[88px]">
                  {minutesList.map((minute) => {
                    const isSelected = selectedMinutes === minute;
                    return (
                      <button
                        key={minute}

                        className={cn(
                          "w-full h-[44px] flex items-center justify-center text-lg relative z-10",
                          isSelected
                            ? "text-black dark:text-white font-bold"
                            : "text-black/30 dark:text-white/30 font-normal"
                        )}
                        style={{ lineHeight: '44px' }}
                      >
                        {String(minute).padStart(2, '0')}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* Period Column */}
            <div className="flex-1 relative z-10">
              <div
                ref={periodRef}
                className="h-[220px] overflow-y-scroll scrollbar-hide"
                style={{
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                  overscrollBehavior: 'contain'
                }}
              >
                <div className="py-[88px]">
                  {periods.map((period) => {
                    const isSelected = selectedPeriod === period;
                    return (
                      <button
                        key={period}

                        className={cn(
                          "w-full h-[44px] flex items-center justify-center text-lg relative z-10",
                          isSelected
                            ? "text-black dark:text-white font-bold"
                            : "text-black/30 dark:text-white/30 font-normal"
                        )}
                        style={{ lineHeight: '44px' }}
                      >
                        {period}
                      </button>
                    );
                  })}
                </div>
              </div>
            </div>
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