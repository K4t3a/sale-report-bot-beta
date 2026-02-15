import React from "react";

type Variant = "primary" | "secondary" | "ghost" | "danger";

type Props = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  variant?: Variant;
  size?: "sm" | "md";
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
};

const styles: Record<Variant, React.CSSProperties> = {
  primary: {
    background: "var(--primary)",
    color: "#fff",
    border: "1px solid rgba(15, 23, 42, 0.06)",
    boxShadow: "0 10px 24px rgba(37, 99, 235, 0.22)",
  },
  secondary: {
    background: "#fff",
    color: "var(--text)",
    border: "1px solid rgba(15, 23, 42, 0.10)",
    boxShadow: "0 10px 22px rgba(15, 23, 42, 0.06)",
  },
  ghost: {
    background: "transparent",
    color: "var(--text)",
    border: "1px solid transparent",
    boxShadow: "none",
  },
  danger: {
    background: "rgba(239, 68, 68, 0.10)",
    color: "#991b1b",
    border: "1px solid rgba(239, 68, 68, 0.22)",
    boxShadow: "none",
  },
};

const sizeStyles: Record<NonNullable<Props["size"]>, React.CSSProperties> = {
  sm: { height: 34, padding: "0 12px", fontSize: 13 },
  md: { height: 38, padding: "0 14px", fontSize: 14 },
};

const Button: React.FC<Props> = ({
  variant = "secondary",
  size = "md",
  leftIcon,
  rightIcon,
  style,
  disabled,
  children,
  ...rest
}) => {
  return (
    <button
      {...rest}
      disabled={disabled}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        gap: 10,
        borderRadius: 999,
        fontWeight: 500, // было жирно — делаем спокойнее
        letterSpacing: "0.01em",
        cursor: disabled ? "not-allowed" : "pointer",
        opacity: disabled ? 0.65 : 1,
        transition: "transform 0.12s ease, opacity 0.12s ease, box-shadow 0.12s ease",
        transform: "translateZ(0)",
        ...sizeStyles[size],
        ...styles[variant],
        ...style,
      }}
      onMouseDown={(e) => {
        if (disabled) return;
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(1px)";
      }}
      onMouseUp={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
      }}
      onMouseLeave={(e) => {
        (e.currentTarget as HTMLButtonElement).style.transform = "translateY(0px)";
      }}
    >
      {leftIcon ? <span style={{ display: "inline-grid", placeItems: "center" }}>{leftIcon}</span> : null}
      <span>{children}</span>
      {rightIcon ? <span style={{ display: "inline-grid", placeItems: "center" }}>{rightIcon}</span> : null}
    </button>
  );
};

export default Button;
