import { valibotResolver } from "@hookform/resolvers/valibot";
import { FIELDS, type BaseProfile, type Blob, type ProfileOverride } from "@omote/lexicon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Checkbox, CheckboxGroup, FileTrigger, Form, Label } from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import type { Session } from "../auth";
import { deleteOverride, saveOverride, uploadImage } from "./api";
import { Field } from "./Field";
import { FIELD_LABEL, Preview } from "./Preview";
import { formSchema, toForm, toRecord, type FormValues, type Images } from "./records";

/**
 * One context's override. Blank means "use my base profile here"; hiding is a separate choice, so the two can never be confused.
 */
export const OverrideEditor = ({
  session,
  handle,
  context,
  base,
  existing,
  problem,
  onDeleted,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly context: string;
  readonly base: BaseProfile | undefined;
  readonly existing: ProfileOverride | undefined;
  /** Set when a record exists for this app but could not be read. */
  readonly problem?: string | undefined;
  readonly onDeleted: () => void;
}) => {
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: valibotResolver(formSchema),
    defaultValues: toForm(existing),
    mode: "onChange",
  });
  const [images, setImages] = useState<Images>({
    ...(existing?.avatar && { avatar: existing.avatar }),
    ...(existing?.banner && { banner: existing.banner }),
  });
  const [localImages, setLocalImages] = useState<Partial<Record<"avatar" | "banner", string>>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["overrides", session.did] });
  const save = useMutation({
    mutationFn: (values: FormValues) =>
      saveOverride(session, context, toRecord(values, images, existing)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteOverride(session, context),
    onSuccess: async () => {
      await refresh();
      onDeleted();
    },
  });
  const upload = useMutation({
    mutationFn: async ({ field, file }: { field: "avatar" | "banner"; file: File }) => {
      const blob: Blob = await uploadImage(session, file);
      return { field, blob, preview: URL.createObjectURL(file) };
    },
    onSuccess: ({ field, blob, preview }) => {
      setImages((current) => ({ ...current, [field]: blob }));
      setLocalImages((current) => ({ ...current, [field]: preview }));
    },
  });

  const draft = toRecord(watch(), images, existing);

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_22rem]">
      <Form
        onSubmit={handleSubmit((values) => save.mutate(values))}
        className="flex flex-col gap-5"
      >
        <div>
          <h2 className="text-xl font-semibold">{context}</h2>
          <p className="text-sm text-neutral-600">
            Leave a field blank to use your base profile in this app.
          </p>
        </div>
        {problem && (
          <p role="alert" className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            You have a profile for this app that omote can't read ({problem}). Saving here replaces
            it.
          </p>
        )}
        <Field control={control} name="displayName" label="Name" />
        <Field control={control} name="pronouns" label="Pronouns" />
        <Field control={control} name="description" label="Bio" multiline />
        <Field control={control} name="website" label="Website" placeholder="https://" />

        <div className="flex flex-wrap gap-3">
          {(["avatar", "banner"] as const).map((field) => (
            <div key={field} className="flex items-center gap-2">
              <FileTrigger
                acceptedFileTypes={["image/png", "image/jpeg"]}
                onSelect={(files) => {
                  const file = files?.[0];
                  if (file) upload.mutate({ field, file });
                }}
              >
                <Button className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {images[field]
                    ? `Replace ${field}`
                    : `Add ${field === "avatar" ? "an" : "a"} ${field} for this app`}
                </Button>
              </FileTrigger>
              {images[field] && (
                <Button
                  className="text-sm text-neutral-600 underline"
                  onPress={() => setImages(({ [field]: _removed, ...rest }) => rest)}
                >
                  Use my base {field}
                </Button>
              )}
            </div>
          ))}
        </div>
        {upload.error && <p className="text-sm text-red-700">{upload.error.message}</p>}

        <Controller
          control={control}
          name="hide"
          render={({ field }) => (
            <CheckboxGroup
              value={field.value}
              onChange={field.onChange}
              className="flex flex-col gap-2"
            >
              <Label className="text-sm font-medium">
                Don't show these from my base profile here
              </Label>
              <div className="flex flex-wrap gap-4">
                {FIELDS.map((name) => (
                  <Checkbox key={name} value={name} className="flex items-center gap-2 text-sm">
                    {({ isSelected }) => (
                      <>
                        <span
                          aria-hidden
                          className={`h-4 w-4 rounded border ${isSelected ? "border-neutral-900 bg-neutral-900" : "border-neutral-400"}`}
                        />
                        {FIELD_LABEL[name]}
                      </>
                    )}
                  </Checkbox>
                ))}
              </div>
            </CheckboxGroup>
          )}
        />

        <div className="flex items-center gap-3">
          <Button
            type="submit"
            isDisabled={save.isPending || !formState.isValid}
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {(existing ?? problem) && (
            <Button
              onPress={() => remove.mutate()}
              isDisabled={remove.isPending}
              className="rounded-md border border-red-300 px-4 py-2 text-red-700"
            >
              Stop customising this app
            </Button>
          )}
          {save.isSuccess && !formState.isDirty && (
            <span className="text-sm text-green-800">Saved.</span>
          )}
        </div>
        {(save.error ?? remove.error) && (
          <p className="text-sm text-red-700">{(save.error ?? remove.error)?.message}</p>
        )}
        <p className="text-xs text-neutral-600">
          This is saved to your own account and is public, like the rest of it. It changes how you
          appear here; it doesn't hide that this is you.
        </p>
      </Form>

      <Preview
        session={session}
        handle={handle}
        context={context}
        base={base}
        draft={draft}
        localImages={localImages}
      />
    </div>
  );
};
