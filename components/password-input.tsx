"use client";

import { useState } from "react";
import { Input } from "@/components/ui/input";

export function PasswordInput({
  id,
  name,
  autoComplete,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  name: string;
  autoComplete: string;
  placeholder?: string;
  value?: string;
  onChange?: (value: string) => void;
}) {
  const [shown, setShown] = useState(false);

  return (
    <div className="password-control">
      <Input
        id={id}
        name={name}
        type={shown ? "text" : "password"}
        autoComplete={autoComplete}
        placeholder={placeholder}
        required
        value={value}
        onChange={
          onChange ? (event) => onChange(event.target.value) : undefined
        }
      />
      <button
        className="password-toggle"
        type="button"
        onClick={() => setShown((current) => !current)}
        aria-pressed={shown}
        aria-label={shown ? "Hide password" : "Show password"}
      >
        {shown ? "Hide" : "Show"}
      </button>
    </div>
  );
}
