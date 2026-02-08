import type { ButtonHTMLAttributes } from "react";

type ButtonVariant = "primary" | "outline" | "ghost";

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: ButtonVariant;
};

const variantClasses: Record<ButtonVariant, string> = {
  primary: "btn btn-primary",
  outline: "btn btn-outline",
  ghost: "btn btn-ghost",
};

export function Button({ variant = "primary", className = "", ...props }: ButtonProps) {
  const classes = `${variantClasses[variant]} ${className}`.trim();
  return <button className={classes} {...props} />;
}
