import { IMAGE_TYPES, type Blob, type Field, type Source } from "@omote-social/lexicon";
import { blobUrl, type Value } from "@omote-social/profiles";
import {
  Button,
  FieldError,
  FileTrigger,
  Input,
  Label,
  Text,
  TextArea,
  TextField,
} from "react-aria-components";
import { Controller, type Control } from "react-hook-form";
import type { Session } from "../auth";
import { describeImageRule } from "./api";
import { nameOf } from "./collections";
import type { FieldValue, FormValues } from "./form-model";
import { FIELD_LABEL } from "./labels";
import type { FieldRule } from "./shape";

/** What a field inherits: the value its bases give, and which record gave it. */
export interface Inherited {
  readonly value?: Value;
  readonly source?: Source;
}

interface Props {
  readonly control: Control<FormValues>;
  readonly field: Field;
  readonly rule: FieldRule;
  readonly inherited: Inherited;
  /** The record builds on others, so a field can inherit rather than only be empty. */
  readonly canInherit: boolean;
}

const status = (value: FieldValue, inherited: Inherited, canInherit: boolean): string => {
  if (value.mode === "set") return "Set here";
  if (value.mode === "hide") return "Hidden here";
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
      {status(value, inherited, canInherit)}
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
 * An image: the one the app shows today, and ways to replace it, inherit it or hide it. Uploads are checked against this app's own formats and size.
 */
export const ImageFieldControl = ({
  control,
  field,
  rule,
  inherited,
  canInherit,
  session,
  localImage,
  onUpload,
  uploading,
}: Props & {
  readonly session: Session;
  /** A just-chosen file, shown from the file itself. */
  readonly localImage?: string;
  readonly onUpload: (file: File) => Promise<Blob | undefined>;
  readonly uploading: boolean;
}) => (
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
      const shape = field === "banner" ? "h-16 w-40 rounded-md" : "h-16 w-16 rounded-full";
      // Offer what this app takes, narrowed to what a browser can pick from.
      const accept = rule.accept?.filter((type) => !type.endsWith("/*")) ?? [...IMAGE_TYPES];

      return (
        <div className="flex flex-col gap-2">
          <Header
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
            <FileTrigger
              acceptedFileTypes={accept.length > 0 ? accept : ["image/*"]}
              onSelect={async (files) => {
                const file = files?.[0];
                const image = file && (await onUpload(file));
                if (image) onChange({ mode: "set", text: "", image });
              }}
            >
              <Button
                isDisabled={uploading}
                className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
              >
                {uploading
                  ? "Uploading…"
                  : src
                    ? `Replace ${FIELD_LABEL[field].toLowerCase()}`
                    : `Choose ${field === "avatar" ? "an avatar" : "a banner"}`}
              </Button>
            </FileTrigger>
            {current.mode === "set" && !canInherit && !rule.required && (
              <Button className={ACTION} onPress={() => onChange({ mode: "inherit", text: "" })}>
                Remove
              </Button>
            )}
          </div>
          <p className="text-xs text-neutral-600">This app takes {describeImageRule(rule)}.</p>
          {fieldState.error && <p className="text-xs text-red-700">{fieldState.error.message}</p>}
        </div>
      );
    }}
  />
);
