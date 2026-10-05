"use client";

import { useState } from "react";
import { Eye, EyeOff, Lock } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";

interface MaskedInputProps {
  id: string;
  name?: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  required?: boolean;
  disabled?: boolean;
  label?: string;
  className?: string;
}

export function MaskedInput({
  id,
  name,
  value,
  onChange,
  placeholder,
  required,
  disabled,
  label,
  className = "",
}: MaskedInputProps) {
  const [show, setShow] = useState(false);

  return (
    <div className="relative flex items-center">
      <Input
        id={id}
        name={name}
        type={show ? "text" : "password"}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        disabled={disabled}
        className={`pr-10 font-mono tracking-wider text-sm ${className}`}
        aria-label={label || placeholder || "Sensitive input"}
      />
      <Button
        type="button"
        variant="ghost"
        size="icon"
        onClick={() => setShow(!show)}
        className="absolute right-1 h-7 w-7 text-slate-400 hover:text-slate-700"
        title={show ? "Mask sensitive value" : "Reveal sensitive value"}
      >
        {show ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
      </Button>
    </div>
  );
}
