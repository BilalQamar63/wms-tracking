import { forwardRef, type InputHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { controlClass } from './form-field';

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  invalid?: boolean;
}

export const Input = forwardRef<HTMLInputElement, InputProps>(function Input(
  { invalid, className, ...props },
  ref,
) {
  return <input ref={ref} className={cn(controlClass(invalid), className)} aria-invalid={invalid} {...props} />;
});
