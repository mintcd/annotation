import React, { useState } from 'react';
import dropdownStyles from '../styles/Dropdown.styles';
import { useDropdown } from '../hooks/Dropdown.hooks';

interface DropdownOption<T = string> {
  value: T;
  label: string;
}

interface DropdownProps<T = string> {
  options: DropdownOption<T>[];
  value: T;
  onChange: (value: T) => void;
  buttonContent: React.ReactNode;
  className?: string;
  ariaLabel?: string;
}

function Dropdown<T = string>({ options, value, onChange, buttonContent, className = '', ariaLabel }: DropdownProps<T>) {
  const [buttonHover, setButtonHover] = useState(false);
  const [buttonFocus, setButtonFocus] = useState(false);
  const [itemHovers, setItemHovers] = useState<Record<number, boolean>>({});
  const [itemFocuses, setItemFocuses] = useState<Record<number, boolean>>({});
  const { open, setOpen, ref } = useDropdown();

  return (
    <div style={dropdownStyles.container} className={className} ref={ref}>
      <button
        type="button"
        onClick={() => setOpen(!open)}
        onMouseEnter={() => setButtonHover(true)}
        onMouseLeave={() => setButtonHover(false)}
        onFocus={() => setButtonFocus(true)}
        onBlur={() => setButtonFocus(false)}
        style={dropdownStyles.button(buttonHover, buttonFocus)}
        aria-label={ariaLabel}
      >
        {buttonContent}
      </button>
      {open && (
        <div style={dropdownStyles.menu}>
          {options.map((option, index) => (
            <div
              key={String(option.value)}
              onClick={() => {
                onChange(option.value);
                setOpen(false);
              }}
              onMouseEnter={() => setItemHovers(prev => ({ ...prev, [index]: true }))}
              onMouseLeave={() => setItemHovers(prev => ({ ...prev, [index]: false }))}
              onFocus={() => setItemFocuses(prev => ({ ...prev, [index]: true }))}
              onBlur={() => setItemFocuses(prev => ({ ...prev, [index]: false }))}
              style={dropdownStyles.menuItem(itemHovers[index], itemFocuses[index])}
            >
              {option.label}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default Dropdown;