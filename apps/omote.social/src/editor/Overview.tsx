import { FIELDS, type Blob, type Field } from "@omote-social/lexicon";
import { blobUrl } from "@omote-social/profiles";
import { Button } from "react-aria-components";
import type { Session } from "../auth";
import { FIELD_LABEL } from "./Preview";
import type { Cell, CellOrigin, Overview as Model } from "./overview-model";

const ORIGIN_LABEL: Record<CellOrigin, string> = {
  override: "Set here",
  base: "From your base profile",
  hidden: "Hidden here",
  native: "The app's own profile",
};

const ORIGIN_STYLE: Record<CellOrigin, string> = {
  override: "bg-emerald-50 text-emerald-900",
  base: "bg-neutral-100 text-neutral-700",
  hidden: "bg-amber-50 text-amber-900",
  native: "bg-sky-50 text-sky-900",
};

/**
 * Every app you appear in, and where each field there comes from. The view no single app can offer, because no single app can see the others.
 */
export const Overview = ({
  session,
  model,
  onOpen,
}: {
  readonly session: Session;
  readonly model: Model;
  readonly onOpen: (context: string) => void;
}) => {
  const show = (field: Field, cell: Cell) => {
    if (cell.value === undefined) return cell.origin === "hidden" ? "Not shown" : "—";
    if (typeof cell.value === "string") return cell.value;
    const url = blobUrl(session.pds, session.did, cell.value as Blob);
    return (
      <img
        src={url}
        alt=""
        className={
          field === "banner" ? "h-8 w-20 rounded object-cover" : "h-8 w-8 rounded-full object-cover"
        }
      />
    );
  };

  return (
    <section aria-labelledby="overview-heading" className="flex flex-col gap-4">
      <div>
        <h2 id="overview-heading" className="text-xl font-semibold">
          Where you appear
        </h2>
        <p className="text-sm text-neutral-600">
          Each column is an app. Changing your base profile changes every column marked "from your
          base profile", and nothing else.
        </p>
      </div>

      {model.columns.length === 0 ? (
        <p className="text-neutral-600">
          No other app keeps a profile for you yet, so every app shows your base profile.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left align-bottom">
                <th scope="col" className="p-3 font-medium text-neutral-600">
                  Field
                </th>
                <th scope="col" className="p-3 font-semibold">
                  Base profile
                  <div className="text-xs font-normal text-neutral-600">app.bsky.actor.profile</div>
                </th>
                {model.columns.map((column) => (
                  <th key={column.context} scope="col" className="p-3">
                    <Button
                      onPress={() => onOpen(column.context)}
                      className="font-semibold underline-offset-2 hover:underline"
                    >
                      {column.context}
                    </Button>
                    <div className="text-xs font-normal text-neutral-600">
                      {[
                        column.override && "Customised with omote",
                        column.native && `Its own record: ${column.native}`,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </div>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {FIELDS.map((field) => (
                <tr key={field} className="border-b border-neutral-100 align-top last:border-0">
                  <th scope="row" className="p-3 text-left font-medium text-neutral-700">
                    {FIELD_LABEL[field]}
                  </th>
                  <td className="max-w-48 p-3 break-words">{show(field, model.base[field])}</td>
                  {model.columns.map((column) => {
                    const cell = column.cells[field];
                    return (
                      <td key={column.context} className="max-w-48 p-3 break-words">
                        <div className="flex flex-col items-start gap-1">
                          {show(field, cell)}
                          {cell.origin && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${ORIGIN_STYLE[cell.origin]}`}
                            >
                              {ORIGIN_LABEL[cell.origin]}
                            </span>
                          )}
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {model.columns.some((column) => column.native && !column.override) && (
        <p className="text-xs text-neutral-600">
          Apps showing "the app's own profile" keep a separate profile that omote can show but not
          change. Edit it in that app. Whether that app falls back to your base profile for anything
          else is up to the app.
        </p>
      )}
    </section>
  );
};
