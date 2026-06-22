"use client";

import { useState, type InputHTMLAttributes } from "react";

type DefaultNumberInputProps = Omit<
  InputHTMLAttributes<HTMLInputElement>,
  "defaultValue" | "onChange"
> & {
  defaultValue: string | number;
};

function normalizeValue(value: string | number) {
  return String(value);
}

export function DefaultNumberInput({
  className = "",
  defaultValue,
  ...props
}: DefaultNumberInputProps) {
  const defaultString = normalizeValue(defaultValue);
  const [value, setValue] = useState(defaultString);
  const isDefault = value === defaultString;

  return (
    <input
      {...props}
      value={value}
      onChange={(event) => setValue(event.target.value)}
      className={`${className} ${isDefault ? "input-default" : ""}`.trim()}
    />
  );
}
