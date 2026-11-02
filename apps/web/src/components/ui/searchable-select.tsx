'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { controlClass } from './form-field';
import { Input } from './input';

interface SearchableSelectProps {
  id: string;
  value: string;
  options: readonly string[];
  onChange: (value: string) => void;
  disabled?: boolean;
  invalid?: boolean;
  placeholder?: string;
}

export function SearchableSelect({
  id,
  value,
  options,
  onChange,
  disabled,
  invalid,
  placeholder = 'Select…',
}: SearchableSelectProps) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const filteredOptions = options.filter((option) =>
    option.toLocaleLowerCase().includes(query.trim().toLocaleLowerCase()),
  );

  useEffect(() => {
    if (open) searchRef.current?.focus();
    else setQuery('');
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutsideClick = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOnOutsideClick);
    return () => document.removeEventListener('pointerdown', closeOnOutsideClick);
  }, [open]);

  return (
    <div ref={rootRef} className="relative">
      <button
        id={id}
        type="button"
        role="combobox"
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={`${id}-options`}
        aria-invalid={invalid}
        disabled={disabled}
        onClick={() => setOpen((current) => !current)}
        className={cn(
          controlClass(invalid),
          'flex items-center justify-between gap-2 text-left',
          disabled && 'cursor-not-allowed',
        )}
      >
        <span className={cn('truncate', !value && 'text-slate-400')}>
          {value || placeholder}
        </span>
        <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" aria-hidden />
      </button>
      {open && (
        <div className="absolute z-30 mt-1 w-full rounded-lg border border-slate-200 bg-white p-2 shadow-lg">
          <Input
            ref={searchRef}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') setOpen(false);
              if (event.key === 'Enter' && filteredOptions[0]) {
                event.preventDefault();
                onChange(filteredOptions[0]);
                setOpen(false);
              }
            }}
            placeholder="Search by name or mobile number"
            autoComplete="off"
            aria-label="Search contacts"
          />
          <ul
            id={`${id}-options`}
            role="listbox"
            aria-label="Contacts"
            className="mt-2 max-h-56 overflow-y-auto"
          >
            {filteredOptions.length ? (
              filteredOptions.map((option) => (
                <li key={option} role="presentation">
                  <button
                    type="button"
                    role="option"
                    aria-selected={value === option}
                    onClick={() => {
                      onChange(option);
                      setOpen(false);
                    }}
                    className={cn(
                      'w-full rounded-md px-3 py-2 text-left text-sm text-slate-700 hover:bg-slate-100',
                      value === option && 'bg-slate-100 font-medium text-slate-900',
                    )}
                  >
                    {option}
                  </button>
                </li>
              ))
            ) : (
              <li className="px-3 py-2 text-sm text-slate-500">No contacts found</li>
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
