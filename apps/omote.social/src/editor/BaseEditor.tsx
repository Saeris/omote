import { valibotResolver } from "@hookform/resolvers/valibot";
import { FIELDS, IMAGE_TYPES, NSID_BASE_PROFILE, blobSchema } from "@omote-social/lexicon";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Button,
  Checkbox,
  CheckboxGroup,
  FileTrigger,
  Form,
  Label,
  Switch,
} from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import * as v from "valibot";
import type { Session } from "../auth";
import { deleteBase, saveBase, uploadImage, type Profiles } from "./api";
import { Field } from "./Field";
import { FIELD_LABEL, Preview } from "./Preview";
import { formSchema, toForm, toRecord, type FormValues, type Images } from "./records";

const imageOf = (value: unknown) => {
  const parsed = v.safeParse(blobSchema, value);
  return parsed.success ? parsed.output : undefined;
};

/**
 * The shared base: a profile that belongs to you rather than to any app, which apps can build on. Blank means "inherit"; hiding is a separate choice, so the two can never be confused.
 */
export const BaseEditor = ({
  session,
  handle,
  profiles,
  onDeleted,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly profiles: Profiles;
  readonly onDeleted: () => void;
}) => {
  const existing = profiles.get(NSID_BASE_PROFILE);
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, formState } = useForm<FormValues>({
    resolver: valibotResolver(formSchema),
    defaultValues: toForm(existing),
    mode: "onChange",
  });
  const [images, setImages] = useState<Images>(() => {
    const avatar = imageOf(existing?.avatar);
    const banner = imageOf(existing?.banner);
    return { ...(avatar && { avatar }), ...(banner && { banner }) };
  });
  const [localImages, setLocalImages] = useState<Partial<Record<"avatar" | "banner", string>>>({});

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profiles", session.did] });
  const save = useMutation({
    mutationFn: (values: FormValues) => saveBase(session, toRecord(values, images, existing)),
    onSuccess: refresh,
  });
  const remove = useMutation({
    mutationFn: () => deleteBase(session),
    onSuccess: async () => {
      await refresh();
      onDeleted();
    },
  });
  const upload = useMutation({
    mutationFn: async ({ field, file }: { field: "avatar" | "banner"; file: File }) => ({
      field,
      blob: await uploadImage(session, file),
      preview: URL.createObjectURL(file),
    }),
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
          <h2 className="text-xl font-semibold">Shared profile</h2>
          <p className="text-sm text-neutral-600">
            A profile that belongs to you, not to any app. Apps that build on it show what you set
            here. Leave a field blank to inherit it.
          </p>
        </div>

        <Controller
          control={control}
          name="fromBluesky"
          render={({ field }) => (
            <Switch
              isSelected={field.value}
              onChange={field.onChange}
              className="group flex items-center gap-3 text-sm"
            >
              <span
                aria-hidden
                className="flex h-5 w-9 items-center rounded-full bg-neutral-300 px-0.5 group-data-[selected]:bg-neutral-900"
              >
                <span className="h-4 w-4 rounded-full bg-white transition-transform group-data-[selected]:translate-x-4" />
              </span>
              Start from my Bluesky profile
            </Switch>
          )}
        />

        <Field control={control} name="displayName" label="Name" />
        <Field control={control} name="pronouns" label="Pronouns" />
        <Field control={control} name="description" label="Bio" multiline />
        <Field control={control} name="website" label="Website" placeholder="https://" />

        <div className="flex flex-wrap gap-3">
          {(["avatar", "banner"] as const).map((field) => (
            <div key={field} className="flex items-center gap-2">
              <FileTrigger
                acceptedFileTypes={[...IMAGE_TYPES]}
                onSelect={(files) => {
                  const file = files?.[0];
                  if (file) upload.mutate({ field, file });
                }}
              >
                <Button className="rounded-md border border-neutral-300 px-3 py-2 text-sm">
                  {images[field]
                    ? `Replace ${field}`
                    : `Choose ${field === "avatar" ? "an" : "a"} ${field}`}
                </Button>
              </FileTrigger>
              {images[field] && (
                <Button
                  className="text-sm text-neutral-600 underline"
                  onPress={() => setImages(({ [field]: _removed, ...rest }) => rest)}
                >
                  Inherit instead
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
              <Label className="text-sm font-medium">Don't show these, even if inherited</Label>
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
          {existing && (
            <Button
              onPress={() => remove.mutate()}
              isDisabled={remove.isPending}
              className="rounded-md border border-red-300 px-4 py-2 text-red-700"
            >
              Delete shared profile
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
          appear; it doesn't hide that this is you.
        </p>
      </Form>

      <Preview
        session={session}
        handle={handle}
        profiles={profiles}
        draft={draft}
        localImages={localImages}
      />
    </div>
  );
};
