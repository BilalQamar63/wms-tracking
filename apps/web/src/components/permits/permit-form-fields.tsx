'use client';

import type { ChangeEvent } from 'react';
import type { FieldErrors, UseFormRegister, UseFormSetValue } from 'react-hook-form';
import {
  addDaysToYmd,
  FORM_SECTIONS,
  PERMIT_FIELD_LIST,
  type PermitFieldDef,
  type PermitInput,
} from '@wms/shared';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

interface Props {
  register: UseFormRegister<PermitInput>;
  setValue: UseFormSetValue<PermitInput>;
  errors: FieldErrors<PermitInput>;
}

function FieldControl({
  field,
  register,
  setValue,
  invalid,
}: {
  field: PermitFieldDef;
  register: Props['register'];
  setValue: Props['setValue'];
  invalid: boolean;
}) {
  const name = field.key as keyof PermitInput;
  const id = `permit-${field.key}`;

  switch (field.type) {
    case 'multiselect':
      return (
        <div className="grid gap-2 rounded-lg border border-slate-200 bg-white p-3 sm:grid-cols-2">
          {(field.options ?? []).map((option, index) => (
            <label key={option} className="flex items-start gap-2 text-sm text-slate-700">
              <input
                id={index === 0 ? id : `${id}-${index}`}
                type="checkbox"
                value={option}
                className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand-700 focus:ring-brand-500"
                {...register(name)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    case 'select':
      return <Select id={id} options={field.options ?? []} invalid={invalid} {...register(name)} />;
    case 'date': {
      const registration = register(name);
      return (
        <Input
          id={id}
          type="date"
          invalid={invalid}
          {...registration}
          readOnly={field.key === 'planValidEndDate'}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            registration.onChange(event);
            if (field.key === 'planValidStartDate') {
              setValue(
                'planValidEndDate',
                event.target.value ? addDaysToYmd(event.target.value, 13) : '',
                {
                  shouldDirty: true,
                  shouldValidate: true,
                },
              );
            }
          }}
        />
      );
    }
    case 'textarea':
      return <Textarea id={id} invalid={invalid} {...register(name)} />;
    default:
      return <Input id={id} type="text" invalid={invalid} {...register(name)} />;
  }
}

/** Renders every register field, grouped by section – generated from the shared field config. */
export function PermitFormFields({ register, setValue, errors }: Props) {
  return (
    <div className="space-y-6">
      {FORM_SECTIONS.map((section) => {
        const fields = PERMIT_FIELD_LIST.filter((f) => f.section === section.id);
        return (
          <fieldset key={section.id}>
            <legend className="mb-3 text-xs font-semibold uppercase tracking-wide text-slate-500">
              {section.title}
            </legend>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              {fields.map((field) => {
                const error = errors[field.key as keyof PermitInput]?.message;
                return (
                  <FormField
                    key={field.key}
                    label={field.header}
                    htmlFor={`permit-${field.key}`}
                    required={field.required}
                    error={error}
                    className={cn(field.fullWidth && 'sm:col-span-2')}
                  >
                    <FieldControl
                      field={field}
                      register={register}
                      setValue={setValue}
                      invalid={!!error}
                    />
                  </FormField>
                );
              })}
            </div>
          </fieldset>
        );
      })}
    </div>
  );
}
