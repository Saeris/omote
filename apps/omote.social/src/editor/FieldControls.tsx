import type { Blob, Field, Source } from "@omote-social/lexicon";
import { blobUrl, type Value } from "@omote-social/profiles";
import { Button, FieldError, Input, Label, Text, TextArea, TextField } from "react-aria-components";
import { useState } from "react";
import { Controller, type Control } from "react-hook-form";
import type { Session } from "../auth";
import { nameOf } from "./collections";
import type { FieldValue, FormValues } from "./form-model";
import { AVATAR, BANNER, ImageDialog, type Choice, type Picked } from "./image/ImageDialog";
import { FIELD_LABEL, hiddenLabel, ownLabel } from "./labels";
import type { FieldRule } from "./shape";

/** What a field inherits: the value its bases give, and which record gave it. */
export interface Inherited {
  readonly value?: Value;
  readonly source?: Source;
}

interface Props {
  readonly control: Control<FormValues>;
  /** The record being edited, which the labels name. */
  readonly collection: string;
  readonly field: Field;
  readonly rule: FieldRule;
  readonly inherited: Inherited;
  /** The record builds on others, so a field can inherit rather than only be empty. */
  readonly canInherit: boolean;
}

const status = (
  collection: string,
  value: FieldValue,
  inherited: Inherited,
  canInherit: boolean,
): string => {
  if (value.mode === "set") return ownLabel(collection);
  if (value.mode === "hide") return hiddenLabel(collection);
  if (inherited.source?.hidden) return `Hidden by ${nameOf(inherited.source.collection)}`;
  if (inherited.source) return `From ${nameOf(inherited.source.collection)}`;
  return canInherit ? "Nothing to inherit" : "Not set";
};

const STATUS_STYLE: Record<FieldValue["mode"], string> = {
  set: "bg-emerald-50 text-emerald-900",
  inherit: "bg-neutral-100 text-neutral-700",
  hide: "bg-amber-50 text-amber-900",
};

const ACTION = "text-xs text-neutral-600 underline underline-offset-2";

/** The label row: the field's name, where its value comes from, and what can be done about it. */
const Header = ({
  collection,
  field,
  value,
  onChange,
  rule,
  inherited,
  canInherit,
}: {
  readonly field: Field;
  readonly value: FieldValue;
  readonly onChange: (value: FieldValue) => void;
} & Omit<Props, "control" | "field">) => (
  <div className="flex flex-wrap items-center gap-2">
    <Label className="text-sm font-medium">{FIELD_LABEL[field]}</Label>
    <span className={`rounded px-1.5 py-0.5 text-xs ${STATUS_STYLE[value.mode]}`}>
      {status(collection, value, inherited, canInherit)}
    </span>
    <span className="ml-auto flex gap-3">
      {value.mode === "set" && canInherit && (
        <Button className={ACTION} onPress={() => onChange({ mode: "inherit", text: "" })}>
          {inherited.source ? `Use ${nameOf(inherited.source.collection)}'s` : "Clear"}
        </Button>
      )}
      {value.mode !== "hide" && rule.nullable && canInherit && (
        <Button className={ACTION} onPress={() => onChange({ mode: "hide", text: "" })}>
          Hide
        </Button>
      )}
      {value.mode === "hide" && (
        <Button className={ACTION} onPress={() => onChange({ mode: "inherit", text: "" })}>
          Show
        </Button>
      )}
    </span>
  </div>
);

/**
 * A text field that opens on what the app shows today. An inherited value is displayed muted; typing into it makes it this record's own.
 */
export const TextFieldControl = ({
  control,
  collection,
  field,
  rule,
  inherited,
  canInherit,
  multiline = false,
  placeholder,
}: Props & { readonly multiline?: boolean; readonly placeholder?: string }) => (
  <Controller
    control={control}
    name={`fields.${field}`}
    render={({ field: { value, onChange, onBlur, ref }, fieldState }) => {
      const current = value ?? { mode: "inherit", text: "" };
      const inheritedText = typeof inherited.value === "string" ? inherited.value : "";
      const shown =
        current.mode === "set" ? current.text : current.mode === "inherit" ? inheritedText : "";
      const muted = current.mode !== "set" ? "text-neutral-500" : "";
      const inputClass = `rounded-md border border-neutral-300 px-3 py-2 disabled:bg-neutral-100 data-[invalid]:border-red-600 ${muted}`;

      return (
        <TextField
          className="flex flex-col gap-1"
          value={shown}
          onChange={(text) => onChange({ mode: "set", text })}
          onBlur={onBlur}
          isDisabled={current.mode === "hide"}
          isInvalid={fieldState.invalid}
          validationBehavior="aria"
        >
          <Header
            collection={collection}
            field={field}
            value={current}
            onChange={onChange}
            rule={rule}
            inherited={inherited}
            canInherit={canInherit}
          />
          {multiline ? (
            <TextArea
              ref={ref}
              rows={4}
              placeholder={current.mode === "hide" ? "Hidden in this app" : placeholder}
              className={inputClass}
            />
          ) : (
            <Input
              ref={ref}
              placeholder={current.mode === "hide" ? "Hidden in this app" : placeholder}
              className={inputClass}
            />
          )}
          {rule.maxGraphemes !== undefined && current.mode === "set" && (
            <Text slot="description" className="text-xs text-neutral-600">
              Up to {rule.maxGraphemes} characters in this app.
            </Text>
          )}
          <FieldError className="text-xs text-red-700">{fieldState.error?.message}</FieldError>
        </TextField>
      );
    }}
  />
);

/**
 * An image: the one the app shows today, and ways to replace it, inherit it or hide it.
 *
 * Replacing opens the image dialog, which frames the image and fits it to this app's formats and size before it is uploaded, or reuses one already in the account.
 */
export const ImageFieldControl = ({
  control,
  collection,
  field,
  rule,
  inherited,
  canInherit,
  session,
  choices,
  localImage,
  onUpload,
  onReuse,
  uploading,
}: Props & {
  readonly session: Session;
  /** Images already in the account that could be used here. */
  readonly choices: readonly Choice[];
  /** A just-chosen file, shown from the file itself. */
  readonly localImage?: string;
  readonly onUpload: (file: globalThis.Blob) => Promise<Blob | undefined>;
  /** An image already in the account was chosen, so any just-uploaded preview no longer applies. */
  readonly onReuse: () => void;
  readonly uploading: boolean;
}) => {
  const [choosing, setChoosing] = useState(false);
  const kind = field === "banner" ? BANNER : AVATAR;

  return (
    <Controller
      control={control}
      name={`fields.${field}`}
      render={({ field: { value, onChange }, fieldState }) => {
        const current = value ?? { mode: "inherit", text: "" };
        const blob =
          current.mode === "set"
            ? current.image
            : current.mode === "inherit" && typeof inherited.value === "object"
              ? inherited.value
              : undefined;
        const src =
          current.mode === "set" && localImage
            ? localImage
            : blob && blobUrl(session.pds, session.did, blob);
        const shape = field === "banner" ? "h-16 w-48 rounded-md" : "h-16 w-16 rounded-full";

        const picked = async (choice: Picked) => {
          setChoosing(false);
          if (choice.kind === "existing") {
            onReuse();
            onChange({ mode: "set", text: "", image: choice.image });
            return;
          }
          const image = await onUpload(choice.file);
          if (image) onChange({ mode: "set", text: "", image });
        };

        return (
          <div className="flex flex-col gap-2">
            <Header
              collection={collection}
              field={field}
              value={current}
              onChange={onChange}
              rule={rule}
              inherited={inherited}
              canInherit={canInherit}
            />
            <div className="flex items-center gap-3">
              <div className={`${shape} shrink-0 overflow-hidden bg-neutral-200`}>
                {src && current.mode !== "hide" && (
                  <img src={src} alt="" className="h-full w-full object-cover" />
                )}
              </div>
              <Button
                isDisabled={uploading}
                onPress={() => setChoosing(true)}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                {uploading
                  ? "Uploading…"
                  : src
                    ? `Replace ${FIELD_LABEL[field].toLowerCase()}`
                    : `Choose ${field === "avatar" ? "an avatar" : "a banner"}`}
              </Button>
              {current.mode === "set" && !canInherit && !rule.required && (
                <Button className={ACTION} onPress={() => onChange({ mode: "inherit", text: "" })}>
                  Remove
                </Button>
              )}
            </div>
            {fieldState.error && <p className="text-xs text-red-700">{fieldState.error.message}</p>}
            {choosing && (
              <ImageDialog
                session={session}
                kind={kind}
                rule={rule}
                choices={choices}
                onPicked={(choice) => void picked(choice)}
                onClose={() => setChoosing(false)}
              />
            )}
          </div>
        );
      }}
    />
  );
};
