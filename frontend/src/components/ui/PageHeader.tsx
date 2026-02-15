import React from "react";

export const PageHeader: React.FC<{
  title: string;
  description?: string;
  right?: React.ReactNode;
}> = ({ title, description, right }) => {
  return (
    <div className="pageHeader">
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 16 }}>
        <div>
          <h1 className="pageTitle">{title}</h1>
          {description ? <p className="pageDesc">{description}</p> : null}
        </div>
        {right ? <div>{right}</div> : null}
      </div>
    </div>
  );
};

export default PageHeader;
