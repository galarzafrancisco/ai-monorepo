import React from "react";

interface TaicoIconProps {
  size?: number;
  className?: string;
}

export function TaicoIcon({ size = 28, className }: TaicoIconProps) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 100 100"
      width={size}
      height={size}
      className={className}
      aria-hidden="true"
    >
      {/* Arc: 330° ring, gap from 12 o'clock to 11 o'clock, square ends */}
      <path
        d="M 50 15 A 35 35 0 1 1 32.5 19.69"
        fill="none"
        stroke="#1B5CF5"
        strokeWidth="16"
        strokeLinecap="butt"
      />
    </svg>
  );
}
