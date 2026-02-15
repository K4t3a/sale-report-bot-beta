import React from "react";

export type CardProps = React.HTMLAttributes<HTMLDivElement> & {
  padded?: boolean;
};

/**
 * Базовая "поверхность" для админки: белая карточка с рамкой/тенью.
 * Используем везде, чтобы интерфейс выглядел единообразно.
 */
export const Card: React.FC<CardProps> = ({
  padded = true,
  className,
  children,
  ...rest
}) => {
  const cls = ["card", padded ? "card-inner" : "", className]
    .filter(Boolean)
    .join(" ");

  return (
    <div className={cls} {...rest}>
      {children}
    </div>
  );
};

export default Card;
