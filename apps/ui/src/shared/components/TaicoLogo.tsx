import React from "react";
import { TaicoIcon } from "./TaicoIcon";
import "./TaicoLogo.css";

interface TaicoLogoProps {
  iconSize?: number;
  showWordmark?: boolean;
  className?: string;
}

export function TaicoLogo({ iconSize = 28, showWordmark = true, className }: TaicoLogoProps) {
  return (
    <div className={`taico-logo ${className ?? ""}`}>
      <TaicoIcon size={iconSize} />
      {showWordmark && <span className="taico-logo__wordmark">taico</span>}
    </div>
  );
}
