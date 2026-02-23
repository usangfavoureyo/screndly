"use client";

import * as React from "react";
import { CheckIcon, ChevronDownIcon } from "lucide-react";
import { cn } from "./utils";
import { haptics } from "../../utils/haptics";
import { BottomSheet } from "./bottom-sheet";

// Context to manage state between Select components
const SelectContext = React.createContext<{
  value?: string;
  onValueChange?: (value: string) => void;
  open: boolean;
  setOpen: (open: boolean) => void;
  items: Record<string, string>;
  registerItem: (value: string, label: string) => void;
  unRegisterItem: (value: string) => void;
}>({
  open: false,
  setOpen: () => { },
  items: {},
  registerItem: () => { },
  unRegisterItem: () => { },
});

function Select({
  value,
  defaultValue,
  onValueChange,
  onOpenChange,
  open: controlledOpen,
  defaultOpen,
  children,
}: {
  value?: string;
  defaultValue?: string;
  onValueChange?: (value: string) => void;
  onOpenChange?: (open: boolean) => void;
  open?: boolean;
  defaultOpen?: boolean;
  children: React.ReactNode;
}) {
  const [internalValue, setInternalValue] = React.useState(defaultValue || value);
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen || false);
  const [items, setItems] = React.useState<Record<string, string>>({});

  const isControlled = value !== undefined;
  const actualValue = isControlled ? value : internalValue;

  const actualValueChange = React.useCallback(
    (v: string) => {
      if (!isControlled) setInternalValue(v);
      onValueChange?.(v);
    },
    [isControlled, onValueChange]
  );

  const isControlledOpen = controlledOpen !== undefined;
  const actualOpen = isControlledOpen ? controlledOpen : internalOpen;

  const actualSetOpen = React.useCallback(
    (o: boolean) => {
      if (!isControlledOpen) setInternalOpen(o);
      onOpenChange?.(o);
    },
    [isControlledOpen, onOpenChange]
  );

  const registerItem = React.useCallback((val: string, label: string) => {
    setItems((prev) => {
      if (prev[val] === label) return prev;
      return { ...prev, [val]: label };
    });
  }, []);

  const unRegisterItem = React.useCallback((val: string) => {
    setItems((prev) => {
      const newItems = { ...prev };
      delete newItems[val];
      return newItems;
    });
  }, []);

  return (
    <SelectContext.Provider
      value={{
        value: actualValue,
        onValueChange: actualValueChange,
        open: actualOpen,
        setOpen: actualSetOpen,
        items,
        registerItem,
        unRegisterItem,
      }}
    >
      {children}
    </SelectContext.Provider>
  );
}

function SelectGroup({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return <div className={cn("py-1", className)} {...props} />;
}

function SelectValue({ placeholder, className, ...props }: React.HTMLAttributes<HTMLSpanElement> & { placeholder?: string }) {
  const { value, items } = React.useContext(SelectContext);

  const displayValue = value && items[value] ? items[value] : value;

  return (
    <span
      className={cn("block truncate", !displayValue && "text-muted-foreground", className)}
      {...props}
    >
      {displayValue || placeholder}
    </span>
  );
}

const SelectTrigger = React.forwardRef<
  HTMLButtonElement,
  React.ButtonHTMLAttributes<HTMLButtonElement> & { size?: "sm" | "default" }
>(({ className, size = "default", children, onClick, ...props }, ref) => {
  const { setOpen } = React.useContext(SelectContext);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    haptics.light();
    setOpen(true);
    onClick?.(e);
  };

  return (
    <button
      ref={ref}
      type="button"
      onClick={handleClick}
      className={cn(
        "border-input data-[placeholder]:text-muted-foreground [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-[#292929] dark:focus-visible:border-[#292929] focus-visible:ring-[#292929]/50 aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive flex w-full items-center justify-between gap-2 rounded-md border bg-white dark:bg-[#000000] border-gray-200 dark:border-[#333] text-gray-900 dark:text-white px-3 py-2 text-sm whitespace-nowrap transition-[color,box-shadow] outline-none focus-visible:ring-[3px] disabled:cursor-not-allowed disabled:opacity-50",
        size === "default" && "h-9",
        size === "sm" && "h-8",
        className
      )}
      {...props}
    >
      {children}
      <ChevronDownIcon className="size-4 opacity-50 shrink-0 pointer-events-none" />
    </button>
  );
});
SelectTrigger.displayName = "SelectTrigger";

function SelectContent({ className, children, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  const { open, setOpen } = React.useContext(SelectContext);

  return (
    <BottomSheet
      open={open}
      onOpenChange={setOpen}
      heightMode="auto"
      className={cn("bg-white dark:bg-[#000000] text-gray-900 dark:text-white", className)}
    >
      <div className="flex flex-col gap-1 p-2" {...props}>
        {children}
      </div>
    </BottomSheet>
  );
}

function SelectLabel({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      className={cn("text-muted-foreground px-2 py-1.5 text-xs font-semibold", className)}
      {...props}
    />
  );
}

const SelectItem = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement> & { value: string }
>(({ className, children, value, onClick, ...props }, ref) => {
  const { value: selectedValue, onValueChange, setOpen, registerItem, unRegisterItem } = React.useContext(SelectContext);
  const isSelected = selectedValue === value;
  const contentRef = React.useRef<HTMLSpanElement>(null);

  React.useEffect(() => {
    if (contentRef.current) {
      registerItem(value, contentRef.current.textContent || value);
    }
    return () => unRegisterItem(value);
  }, [value, registerItem, unRegisterItem, children]);

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    haptics.light();
    onValueChange?.(value);
    setOpen(false);
    onClick?.(e);
  };

  return (
    <div
      ref={ref}
      onClick={handleClick}
      role="option"
      aria-selected={isSelected}
      className={cn(
        "relative flex w-full cursor-pointer items-center gap-2 rounded-sm py-3 px-3 text-sm outline-hidden select-none text-gray-900 dark:text-white hover:bg-gray-100 dark:hover:bg-[#333] transition-colors",
        isSelected && "font-medium",
        className
      )}
      style={{
        "--select-item-bg": "#ec1e24",
        "--select-item-bg-dark": "#ec1e24",
      } as React.CSSProperties}
      {...props}
    >
      <span ref={contentRef} className="flex-1 truncate">
        {children}
      </span>
      {isSelected && (
        <span className="flex size-4 items-center justify-center text-[#ec1e24]">
          <CheckIcon className="size-4" />
        </span>
      )}
    </div>
  );
});
SelectItem.displayName = "SelectItem";

function SelectSeparator({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div className={cn("bg-border -mx-1 my-1 h-px", className)} {...props} />
  );
}

// Stubs for API compatibility with radis
function SelectScrollUpButton() {
  return null;
}

function SelectScrollDownButton() {
  return null;
}

export {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectLabel,
  SelectScrollDownButton,
  SelectScrollUpButton,
  SelectSeparator,
  SelectTrigger,
  SelectValue,
};