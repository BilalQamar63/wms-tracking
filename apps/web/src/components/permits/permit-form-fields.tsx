'use client';

import type { ChangeEvent } from 'react';
import {
  useWatch,
  type Control,
  type FieldErrors,
  type UseFormRegister,
  type UseFormSetValue,
} from 'react-hook-form';
import {
  addDaysToYmd,
  FORM_SECTIONS,
  PERMIT_FIELD_LIST,
  getPlanDurationDays,
  getTodayYmd,
  type PermitFieldDef,
  type PermitInput,
} from '@wms/shared';
import { FormField } from '@/components/ui/form-field';
import { Input } from '@/components/ui/input';
import { Select } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils/cn';

interface Props {
  control: Control<PermitInput>;
  register: UseFormRegister<PermitInput>;
  setValue: UseFormSetValue<PermitInput>;
  errors: FieldErrors<PermitInput>;
  assignedSubContractor?: string;
}

function FieldControl({
  field,
  register,
  setValue,
  invalid,
  assignedSubContractor,
}: {
  field: PermitFieldDef;
  register: Props['register'];
  setValue: Props['setValue'];
  invalid: boolean;
  assignedSubContractor?: string;
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
      if (field.key === 'subContractor' && assignedSubContractor) {
        return (
          <>
            <input type="hidden" {...register(name)} />
            <Input id={id} value={assignedSubContractor} readOnly />
          </>
        );
      }
      return (
        <Select
          id={id}
          options={field.options ?? []}
          invalid={invalid}
          defaultValue={field.defaultValue}
          {...register(name)}
        />
      );
    case 'radio':
      return (
        <div className="flex flex-wrap gap-x-5 gap-y-2" role="radiogroup" aria-label={field.header}>
          {(field.options ?? []).map((option, index) => (
            <label key={option} className="inline-flex items-center gap-2 text-sm text-slate-700">
              <input
                id={index === 0 ? id : `${id}-${index}`}
                type="radio"
                value={option}
                className="h-4 w-4 border-slate-300 text-brand-700 focus:ring-brand-500"
                {...register(name)}
              />
              <span>{option}</span>
            </label>
          ))}
        </div>
      );
    case 'date': {
      const registration = register(name);
      return (
        <Input
          id={id}
          type="date"
          max={
            field.key === 'planValidStartDate' ||
            field.key === 'planValidEndDate' ||
            field.key === 'closedDate'
              ? undefined
              : getTodayYmd()
          }
          invalid={invalid}
          {...registration}
          onChange={(event: ChangeEvent<HTMLInputElement>) => {
            registration.onChange(event);
            if (field.key === 'planValidStartDate') {
              setValue(
                'planValidEndDate',
                event.target.value ? addDaysToYmd(event.target.value, 14) : '',
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
    case 'text':
      return (
        <Input
          id={id}
          type="text"
          invalid={invalid}
          readOnly={field.fixedValue !== undefined}
          {...register(name)}
        />
      );
    case 'computed':
      return null;
  }
}

/** Renders every register field, grouped by section – generated from the shared field config. */
export function PermitFormFields({
  control,
  register,
  setValue,
  errors,
  assignedSubContractor,
}: Props) {
  const planStartDate = useWatch({ control, name: 'planValidStartDate' });
  const planEndDate = useWatch({ control, name: 'planValidEndDate' });
  const planDuration =
    planStartDate && planEndDate ? getPlanDurationDays(planStartDate, planEndDate) : null;

  return (
    <div className="space-y-6">
      {FORM_SECTIONS.map((section) => {
        const fields = PERMIT_FIELD_LIST.filter(
          (field) =>
            field.section === section.id &&
            (field.type !== 'computed' || field.key === 'ptwValidity'),
        );
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
                    htmlFor={field.type === 'computed' ? undefined : `permit-${field.key}`}
                    required={field.required}
                    error={error}
                    className={cn(field.fullWidth && 'sm:col-span-2')}
                  >
                    {field.type === 'computed' ? (
                      <div
                        id={`permit-${field.key}`}
                        aria-live="polite"
                        className="flex h-10 items-center rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm font-semibold text-slate-700"
                      >
                        {planDuration === null
                          ? planStartDate && planEndDate
                            ? 'End date must be on or after start date'
                            : 'Select planned start and end dates'
                          : `${planDuration} ${planDuration === 1 ? 'day' : 'days'} left`}
                      </div>
                    ) : (
                      <FieldControl
                        field={field}
                        register={register}
                        setValue={setValue}
                        invalid={!!error}
                        assignedSubContractor={assignedSubContractor}
                      />
                    )}
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
