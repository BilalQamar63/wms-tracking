import { forwardRef, type TextareaHTMLAttributes } from 'react';
import { cn } from '@/lib/utils/cn';
import { controlClass } from './form-field';

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {
  invalid?: boolean;
}

export const Textarea = forwardRef<HTMLTextAreaElement, TextareaProps>(function Textarea(
  { invalid, className, rows = 3, ...props },
  ref,
) {
  return (
    <textarea
      ref={ref}
      rows={rows}
      className={cn(controlClass(invalid), 'h-auto py-2', className)}
      aria-invalid={invalid}
      {...props}
    />
  );
});
