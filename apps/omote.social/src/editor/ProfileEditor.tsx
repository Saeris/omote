import { valibotResolver } from "@hookform/resolvers/valibot";
import { FIELDS, NSID_BASE_PROFILE, type Field } from "@omote-social/lexicon";
import { resolveProfile } from "@omote-social/profiles";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Button, Form, Switch } from "react-aria-components";
import { Controller, useForm } from "react-hook-form";
import { requestAccess, type Session } from "../auth";
import { canWrite } from "../scope";
import { deleteBase, saveProfile, uploadImage, type Profiles } from "./api";
import { nameOf } from "./collections";
import { ImageFieldControl, TextFieldControl } from "./FieldControls";
import {
  basesFor,
  formSchemaFor,
  inheritedFor,
  toForm,
  toRecord,
  type FormValues,
} from "./form-model";
import { ProfileCard, type LocalImages } from "./ProfileCard";
import type { ProfileShape } from "./shape";

const PLACEHOLDER: Partial<Record<Field, string>> = { website: "https://" };

/**
 * One profile record, any app's: the shared base, or an app's own. What it may hold comes from that app's lexicon (`shape`), so omote never writes something the app would refuse.
 */
export const ProfileEditor = ({
  session,
  handle,
  profiles,
  collection,
  shape,
  onDeleted,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly profiles: Profiles;
  readonly collection: string;
  readonly shape: ProfileShape;
  readonly onDeleted: () => void;
}) => {
  const existing = profiles.get(collection);
  const isBase = collection === NSID_BASE_PROFILE;
  const writable = canWrite(session.scope, collection);
  const queryClient = useQueryClient();
  const { control, handleSubmit, watch, formState, reset } = useForm<FormValues>({
    resolver: valibotResolver(formSchemaFor(shape)),
    defaultValues: toForm(existing, shape),
    mode: "onChange",
  });
  const [localImages, setLocalImages] = useState<LocalImages>({});

  const values = watch();
  const bases = shape.extends ? basesFor(values, existing) : [];
  const inherited = inheritedFor(profiles, collection, bases);
  const draft = toRecord(values, existing, collection, shape);
  const preview = resolveProfile(new Map(profiles).set(collection, draft), collection);

  const refresh = () => queryClient.invalidateQueries({ queryKey: ["profiles", session.did] });
  const save = useMutation({
    mutationFn: (submitted: FormValues) =>
      saveProfile(session, collection, toRecord(submitted, existing, collection, shape)),
    onSuccess: async (_, submitted) => {
      // What was saved is the new starting point, so "Saved." shows until the next change.
      reset(submitted);
      await refresh();
    },
  });
  const remove = useMutation({
    mutationFn: () => deleteBase(session),
    onSuccess: async () => {
      await refresh();
      onDeleted();
    },
  });
  const upload = useMutation({
    mutationFn: async ({ field, file }: { field: "avatar" | "banner"; file: File }) => {
      const rule = shape.fields[field];
      if (!rule) return undefined;
      const blob = await uploadImage(session, file, rule);
      setLocalImages((current) => ({ ...current, [field]: URL.createObjectURL(file) }));
      return blob;
    },
  });

  return (
    <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
      <Form
        onSubmit={handleSubmit((submitted) => save.mutate(submitted))}
        className="flex flex-col gap-5"
      >
        <div>
          <h2 className="text-xl font-semibold">{nameOf(collection)}</h2>
          <p className="text-xs text-neutral-600">{collection}</p>
          <p className="mt-2 text-sm text-neutral-600">
            {isBase
              ? "A profile that belongs to you, not to any app. Apps that build on it show what you set here."
              : shape.extends
                ? "This app builds on your other profiles. Leave a field as it is to keep following them."
                : "This app keeps its own profile and doesn't build on your others, so every field here is its own."}
          </p>
        </div>

        {!writable && (
          <div
            role="status"
            className="flex flex-col gap-2 rounded-md bg-sky-50 p-3 text-sm text-sky-950"
          >
            <p>
              omote can't edit your {nameOf(collection)} profile yet. Your server will ask you to
              allow it, for this app only, and bring you back here. Allow it before making changes:
              leaving the page loses them.
            </p>
            <Button
              className="self-start rounded-md bg-sky-900 px-3 py-1.5 text-white"
              onPress={() => void requestAccess(session, collection)}
            >
              Allow editing
            </Button>
          </div>
        )}

        {shape.extends && (
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
        )}

        {FIELDS.map((field) => {
          const rule = shape.fields[field];
          if (!rule) return null;
          const props = {
            control,
            field,
            rule,
            inherited: { value: inherited.fields[field], source: inherited.sources[field] },
            canInherit: shape.extends,
          };
          return rule.kind === "text" ? (
            <TextFieldControl
              key={field}
              {...props}
              multiline={field === "description"}
              placeholder={PLACEHOLDER[field]}
            />
          ) : (
            <ImageFieldControl
              key={field}
              {...props}
              session={session}
              localImage={localImages[field as "avatar" | "banner"]}
              uploading={upload.isPending && upload.variables.field === field}
              onUpload={(file) =>
                upload
                  .mutateAsync({ field: field as "avatar" | "banner", file })
                  .catch(() => undefined)
              }
            />
          );
        })}
        {upload.error && <p className="text-sm text-red-700">{upload.error.message}</p>}

        <div className="flex flex-wrap items-center gap-3">
          <Button
            type="submit"
            isDisabled={!writable || save.isPending || !formState.isValid}
            className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white disabled:opacity-60"
          >
            {save.isPending ? "Saving…" : "Save"}
          </Button>
          {isBase && existing && (
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

      <section aria-label={`How ${nameOf(collection)} will show you`} className="self-start">
        <ProfileCard
          session={session}
          handle={handle}
          collection={collection}
          resolved={preview}
          localImages={localImages}
        />
      </section>
    </div>
  );
};
