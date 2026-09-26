import type { BaseProfile, Field, ProfileOverride, Source } from "@omote/lexicon";
import { blobUrl, mergeProfile } from "@omote/profiles";
import type { Session } from "../auth";

/** How each field is named to people, in the editor and the preview alike. */
export const FIELD_LABEL: Record<Field, string> = {
  displayName: "Name",
  description: "Bio",
  pronouns: "Pronouns",
  website: "Website",
  avatar: "Avatar",
  banner: "Banner",
};

const SOURCE_LABEL: Record<Source, string> = {
  override: "set here",
  base: "from your base profile",
  hidden: "hidden here",
};

/**
 * How this app will show you, merged exactly as `@omote/profiles` does, so what you see here is what an app resolves.
 *
 * A newly chosen image shows from the file itself: the PDS may not serve a blob until a record references it.
 */
export const Preview = ({
  session,
  handle,
  context,
  base,
  draft,
  localImages,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly context: string;
  readonly base: BaseProfile | undefined;
  readonly draft: ProfileOverride;
  readonly localImages: Partial<Record<"avatar" | "banner", string>>;
}) => {
  const { fields, sources } = mergeProfile(base, draft);
  const image = (field: "avatar" | "banner") => {
    const value = fields[field];
    if (sources[field] === "override" && localImages[field]) return localImages[field];
    return typeof value === "object" ? blobUrl(session.pds, session.did, value) : undefined;
  };
  const avatar = image("avatar");
  const banner = image("banner");
  const text = (field: "displayName" | "description" | "pronouns" | "website") =>
    typeof fields[field] === "string" ? fields[field] : undefined;

  return (
    <section
      aria-label={`How ${context} will show you`}
      className="self-start overflow-hidden rounded-xl border border-neutral-200 bg-white"
    >
      <div className="h-24 bg-neutral-200">
        {banner && <img src={banner} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex flex-col gap-1 px-5 pb-5">
        <div className="-mt-8 h-16 w-16 overflow-hidden rounded-full border-4 border-white bg-neutral-300">
          {avatar && <img src={avatar} alt="" className="h-full w-full object-cover" />}
        </div>
        <p className="text-lg font-semibold">
          {text("displayName") ?? `@${handle ?? session.did}`}
        </p>
        <p className="text-sm text-neutral-600">
          @{handle ?? session.did}
          {text("pronouns") && ` · ${text("pronouns")}`}
        </p>
        {text("description") && (
          <p className="mt-2 text-sm whitespace-pre-line">{text("description")}</p>
        )}
        {text("website") && <p className="text-sm text-blue-700">{text("website")}</p>}
        <dl className="mt-4 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs text-neutral-600">
          {Object.entries(sources).map(([field, source]) => (
            <div key={field} className="contents">
              <dt className="font-medium">{FIELD_LABEL[field as Field]}</dt>
              <dd>{SOURCE_LABEL[source]}</dd>
            </div>
          ))}
        </dl>
      </div>
    </section>
  );
};
