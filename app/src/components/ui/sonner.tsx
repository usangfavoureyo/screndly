"use client";

import { useTheme } from "../ThemeProvider";
import { Toaster as Sonner, ToasterProps } from "sonner";

const Toaster = ({ toastOptions, style, ...props }: ToasterProps) => {
  const { theme = "dark" } = useTheme();

  return (
    <Sonner
      theme={theme as ToasterProps["theme"]}
      className="toaster group"
      position="bottom-center"
      style={
        {
          "--normal-bg": "var(--popover)",
          "--normal-text": "var(--popover-foreground)",
          "--normal-border": "var(--border)",
          zIndex: 2147483647,
          ...style,
        } as React.CSSProperties
      }
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastOptions?.classNames,
          toast: [
            "z-[2147483647] border border-[#333333] bg-black text-white shadow-2xl",
            toastOptions?.classNames?.toast,
          ].filter(Boolean).join(" "),
        },
      }}
      {...props}
    />
  );
};

export { Toaster };
