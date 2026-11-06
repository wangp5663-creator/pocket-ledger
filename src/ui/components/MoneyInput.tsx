interface MoneyInputProps {
  value: string;
  onChange: (value: string) => void;
  ariaLabel: string;
  placeholder?: string;
}

export function MoneyInput({ value, onChange, ariaLabel, placeholder = '0.00' }: MoneyInputProps) {
  return (
    <div className="money-input">
      <span className="money-input__prefix">¥</span>
      <input
        inputMode="decimal"
        aria-label={ariaLabel}
        value={value}
        placeholder={placeholder}
        onChange={(event) => onChange(event.target.value)}
      />
    </div>
  );
}
