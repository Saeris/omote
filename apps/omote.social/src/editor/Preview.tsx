import { FIELDS, NSID_BASE_PROFILE, type Field, type Source } from "@omote-social/lexicon";
import { blobUrl, resolveProfile } from "@omote-social/profiles";
import type { Session } from "../auth";
import type { Profiles } from "./api";
import { nameOf } from "./collections";

/** How each field is named to people, in the editor and the preview alike. */
export const FIELD_LABEL: Record<Field, string> = {
  displayName: "Name",
  description: "Bio",
  pronouns: "Pronouns",
  website: "Website",
  avatar: "Avatar",
  banner: "Banner",
};

/** Where a field came from, as seen from one record. */
export const sourceLabel = (here: string, source: Source): string => {
  const own = source.collection === here;
  if (source.hidden) return own ? "Hidden here" : `Hidden by ${nameOf(source.collection)}`;
  return own ? "Set here" : `From ${nameOf(source.collection)}`;
};

/**
 * How the shared base will show you, resolved exactly as `@omote-social/profiles` does, so what you see here is what an app resolves.
 *
 * A newly chosen image shows from the file itself: the PDS may not serve a blob until a record references it.
 */
export const Preview = ({
  session,
  handle,
  profiles,
  draft,
  localImages,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly profiles: Profiles;
  readonly draft: Record<string, unknown>;
  readonly localImages: Partial<Record<"avatar" | "banner", string>>;
}) => {
  const { fields, sources } = resolveProfile(
    new Map(profiles).set(NSID_BASE_PROFILE, draft),
    NSID_BASE_PROFILE,
  );
  const image = (field: "avatar" | "banner") => {
    const value = fields[field];
    if (sources[field]?.collection === NSID_BASE_PROFILE && localImages[field]) {
      return localImages[field];
    }
    return typeof value === "object" ? blobUrl(session.pds, session.did, value) : undefined;
  };
  const avatar = image("avatar");
  const banner = image("banner");
  const text = (field: "displayName" | "description" | "pronouns" | "website") =>
    typeof fields[field] === "string" ? fields[field] : undefined;

  return (
    <section
      aria-label="How apps building on your shared profile will show you"
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
          {FIELDS.map((field) => {
            const source = sources[field];
            return (
              source && (
                <div key={field} className="contents">
                  <dt className="font-medium">{FIELD_LABEL[field]}</dt>
                  <dd>{sourceLabel(NSID_BASE_PROFILE, source)}</dd>
                </div>
              )
            );
          })}
        </dl>
      </div>
    </section>
  );
};
