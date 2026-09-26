import { Button } from "react-aria-components";
import type { Session } from "../auth";
import { nameOf } from "./collections";
import type { Appearance } from "./overview-model";
import { ProfileCard } from "./ProfileCard";

/**
 * Every app you appear in, as each shows you, and where each field there comes from. The view no single app can offer, because no single app can see the others.
 *
 * Cards rather than a table: a long bio or a sixth app should add height, not squeeze every column.
 */
export const Overview = ({
  session,
  handle,
  appearances,
  onOpen,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly appearances: readonly Appearance[];
  readonly onOpen: (collection: string) => void;
}) => (
  <section aria-labelledby="overview-heading" className="flex flex-col gap-4">
    <div>
      <h2 id="overview-heading" className="text-xl font-semibold">
        Where you appear
      </h2>
      <p className="text-sm text-neutral-600">
        Each card is how one app's profile record shows you. Changing a field changes every card
        that says it comes from there, and nothing else.
      </p>
    </div>

    {appearances.length === 0 ? (
      <p className="text-neutral-600">No app keeps a profile for you yet.</p>
    ) : (
      <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {appearances.map((appearance) => (
          <li
            key={appearance.collection}
            className="relative flex flex-col gap-2 rounded-xl has-[[data-hovered]]:[&>div:last-child]:border-neutral-400"
          >
            <div className="px-1">
              {/* The name is the control; its ::after covers the card so all of it opens the editor. */}
              <Button
                onPress={() => onOpen(appearance.collection)}
                className="font-semibold outline-none after:absolute after:inset-0 after:rounded-xl data-[focus-visible]:after:outline-2 data-[focus-visible]:after:outline-offset-2"
              >
                {nameOf(appearance.collection)}
              </Button>
              <p className="text-xs text-neutral-600">
                {appearance.extends.length > 0
                  ? `Builds on ${appearance.extends.map(nameOf).join(", ")}`
                  : "Stands alone"}
              </p>
            </div>
            <ProfileCard
              session={session}
              handle={handle}
              collection={appearance.collection}
              resolved={appearance.resolved}
              compact
            />
          </li>
        ))}
      </ul>
    )}

    <p className="text-xs text-neutral-600">
      A record that "stands alone" names nothing it builds on, so omote can't tell whether that app
      fills gaps from your other profiles. Apps that adopt omote say so in their record.
    </p>
  </section>
);
