import React from "react";

type Tone = "neutral" | "success" | "danger" | "warning";

export type BadgeProps = React.HTMLAttributes<HTMLSpanElement> & {
  tone?: Tone;
};

const toneToClass: Record<Tone, string> = {
  neutral: "badge",
  success: "badge badge-success",
  danger: "badge badge-danger",
  warning: "badge badge-warning",
};

export const Badge: React.FC<BadgeProps> = ({
  tone = "neutral",
  className,
  children,
  ...rest
}) => {
  const cls = [toneToClass[tone], className].filter(Boolean).join(" ");
  return (
    <span className={cls} {...rest}>
      {children}
    </span>
  );
};

export default Badge;
