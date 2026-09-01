import type { ButtonHTMLAttributes, ReactNode } from "react";

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "ghost" | "danger";
}

export function Button({ variant = "primary", className, ...props }: ButtonProps): ReactNode {
  const classes = ["ir-button", `ir-button-${variant}`, className].filter(Boolean).join(" ");
  return <button type="button" {...props} className={classes} />;
}
