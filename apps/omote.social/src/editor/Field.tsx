import { Controller, type Control, type FieldPath, type FieldValues } from "react-hook-form";
import { FieldError, Input, Label, Text, TextArea, TextField } from "react-aria-components";

/**
 * A React Aria text field driven by React Hook Form: RHF owns the value and validation, React Aria owns labelling, error wiring and accessibility.
 */
export const Field = <T extends FieldValues>({
  control,
  name,
  label,
  description,
  placeholder,
  multiline = false,
}: {
  readonly control: Control<T>;
  readonly name: FieldPath<T>;
  readonly label: string;
  readonly description?: string;
  readonly placeholder?: string;
  readonly multiline?: boolean;
}) => (
  <Controller
    control={control}
    name={name}
    render={({ field, fieldState }) => (
      <TextField
        className="flex flex-col gap-1"
        value={field.value as string}
        onChange={field.onChange}
        onBlur={field.onBlur}
        isInvalid={fieldState.invalid}
        validationBehavior="aria"
      >
        <Label className="text-sm font-medium">{label}</Label>
        {multiline ? (
          <TextArea
            ref={field.ref}
            placeholder={placeholder}
            rows={3}
            className="rounded-md border border-neutral-300 px-3 py-2 data-[invalid]:border-red-600"
          />
        ) : (
          <Input
            ref={field.ref}
            placeholder={placeholder}
            className="rounded-md border border-neutral-300 px-3 py-2 data-[invalid]:border-red-600"
          />
        )}
        {description && (
          <Text slot="description" className="text-xs text-neutral-600">
            {description}
          </Text>
        )}
        <FieldError className="text-xs text-red-700">{fieldState.error?.message}</FieldError>
      </TextField>
    )}
  />
);
