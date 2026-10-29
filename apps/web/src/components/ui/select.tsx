import { forwardRef, type SelectHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { controlClass } from './form-field';

export interface SelectOption {
  value: string;
  label: string;
}

export interface SelectProps extends SelectHTMLAttributes<HTMLSelectElement> {
  options: readonly (string | SelectOption)[];
  placeholder?: string;
  invalid?: boolean;
}

export const Select = forwardRef<HTMLSelectElement, SelectProps>(function Select(
  { options, placeholder = 'Select…', invalid, className, ...props },
  ref,
) {
  return (
    <select
      ref={ref}
      className={cn(
        controlClass(invalid),
        !props.multiple && 'pr-8',
        props.multiple && 'h-auto min-h-28 py-2',
        className,
      )}
      aria-invalid={invalid}
      {...props}
    >
      {!props.multiple && <option value="">{placeholder}</option>}
      {options.map((option) => {
        const { value, label } =
          typeof option === 'string' ? { value: option, label: option } : option;
        return (
          <option key={value} value={value}>
            {label}
          </option>
        );
      })}
    </select>
  );
});
