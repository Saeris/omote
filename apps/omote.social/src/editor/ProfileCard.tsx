import { FIELDS } from "@omote-social/lexicon";
import { blobUrl, type Resolved } from "@omote-social/profiles";
import type { Session } from "../auth";
import { FIELD_LABEL, sourceLabel } from "./labels";

export type LocalImages = Partial<Record<"avatar" | "banner", string>>;

/**
 * One profile as an app following its record would show it, and where each field came from.
 *
 * `compact` clamps long text, for the overview's grid; the editor's preview shows it in full.
 */
export const ProfileCard = ({
  session,
  handle,
  collection,
  resolved,
  localImages = {},
  compact = false,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly collection: string;
  readonly resolved: Resolved;
  /** Images just chosen, shown from the file: the PDS may not serve a blob until a record references it. */
  readonly localImages?: LocalImages;
  readonly compact?: boolean;
}) => {
  const { fields, sources } = resolved;
  const image = (field: "avatar" | "banner") => {
    if (sources[field]?.collection === collection && localImages[field]) return localImages[field];
    const value = fields[field];
    return typeof value === "object" ? blobUrl(session.pds, session.did, value) : undefined;
  };
  const text = (field: "displayName" | "description" | "pronouns" | "website") => {
    const value = fields[field];
    return typeof value === "string" ? value : undefined;
  };
  const avatar = image("avatar");
  const banner = image("banner");
  const at = `@${handle ?? session.did}`;

  return (
    <div className="flex h-full flex-col overflow-hidden rounded-xl border border-neutral-200 bg-white text-left">
      <div className={`${compact ? "h-16" : "h-24"} shrink-0 bg-neutral-200`}>
        {banner && <img src={banner} alt="" className="h-full w-full object-cover" />}
      </div>
      <div className="flex min-w-0 flex-1 flex-col gap-1 px-4 pb-4">
        <div className="-mt-7 h-14 w-14 shrink-0 overflow-hidden rounded-full border-4 border-white bg-neutral-300">
          {avatar && <img src={avatar} alt="" className="h-full w-full object-cover" />}
        </div>
        <p className="truncate font-semibold">{text("displayName") ?? at}</p>
        <p className="truncate text-sm text-neutral-600">
          {at}
          {text("pronouns") && ` · ${text("pronouns")}`}
        </p>
        {text("description") && (
          <p
            className={`mt-1 text-sm break-words whitespace-pre-line ${compact ? "line-clamp-3" : ""}`}
          >
            {text("description")}
          </p>
        )}
        {text("website") && <p className="truncate text-sm text-blue-700">{text("website")}</p>}
        <dl className="mt-auto grid grid-cols-[auto_1fr] gap-x-3 gap-y-0.5 pt-3 text-xs text-neutral-600">
          {FIELDS.map((field) => {
            const source = sources[field];
            return (
              source && (
                <div key={field} className="contents">
                  <dt className="font-medium">{FIELD_LABEL[field]}</dt>
                  <dd className="truncate">{sourceLabel(collection, source)}</dd>
                </div>
              )
            );
          })}
        </dl>
      </div>
    </div>
  );
};
