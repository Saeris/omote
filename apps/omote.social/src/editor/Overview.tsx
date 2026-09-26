import { FIELDS, NSID_BASE_PROFILE, type Blob, type Field } from "@omote-social/lexicon";
import { blobUrl } from "@omote-social/profiles";
import { Button } from "react-aria-components";
import type { Session } from "../auth";
import { nameOf } from "./collections";
import type { Cell, Column } from "./overview-model";
import { FIELD_LABEL, sourceLabel } from "./Preview";

const badgeStyle = (column: string, cell: Cell) =>
  cell.source?.hidden
    ? "bg-amber-50 text-amber-900"
    : cell.source?.collection === column
      ? "bg-emerald-50 text-emerald-900"
      : "bg-neutral-100 text-neutral-700";

/**
 * Every app you appear in, and where each field there comes from. The view no single app can offer, because no single app can see the others.
 */
export const Overview = ({
  session,
  columns,
  onEditBase,
}: {
  readonly session: Session;
  readonly columns: readonly Column[];
  readonly onEditBase: () => void;
}) => {
  const show = (field: Field, cell: Cell) => {
    if (cell.value === undefined) return cell.source?.hidden ? "Not shown" : "—";
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
          Each column is an app's profile record. Changing one changes every column that says it
          comes from there, and nothing else.
        </p>
      </div>

      {columns.length === 0 ? (
        <p className="text-neutral-600">No app keeps a profile for you yet.</p>
      ) : (
        <div className="overflow-x-auto rounded-xl border border-neutral-200 bg-white">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 text-left align-bottom">
                <th scope="col" className="p-3 font-medium text-neutral-600">
                  Field
                </th>
                {columns.map((column) => (
                  <th key={column.collection} scope="col" className="p-3">
                    {column.collection === NSID_BASE_PROFILE ? (
                      <Button
                        onPress={onEditBase}
                        className="font-semibold underline-offset-2 hover:underline"
                      >
                        {nameOf(column.collection)}
                      </Button>
                    ) : (
                      <span className="font-semibold">{nameOf(column.collection)}</span>
                    )}
                    <div className="text-xs font-normal text-neutral-600">
                      {column.extends.length > 0
                        ? `Builds on ${column.extends.map(nameOf).join(", ")}`
                        : "Stands alone"}
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
                  {columns.map((column) => {
                    const cell = column.cells[field];
                    return (
                      <td key={column.collection} className="max-w-48 p-3 break-words">
                        <div className="flex flex-col items-start gap-1">
                          {show(field, cell)}
                          {cell.source && (
                            <span
                              className={`rounded px-1.5 py-0.5 text-xs ${badgeStyle(column.collection, cell)}`}
                            >
                              {sourceLabel(column.collection, cell.source)}
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

      <p className="text-xs text-neutral-600">
        A record that "stands alone" names nothing it builds on, so omote can't tell whether that
        app fills gaps from your other profiles. Apps that adopt omote say so in their record. Edit
        other apps' profiles in those apps.
      </p>
    </section>
  );
};
