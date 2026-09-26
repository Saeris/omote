import { resolveProfile } from "@omote-social/profiles";
import { useQuery } from "@tanstack/react-query";
import type { Session } from "../auth";
import { canRequest } from "../scope";
import type { Profiles } from "./api";
import { nameOf } from "./collections";
import { fetchProfileShape } from "./lexicons";
import { ProfileCard } from "./ProfileCard";
import { ProfileEditor } from "./ProfileEditor";

/**
 * One profile: editable when omote knows what the app's record accepts and may ask to write it, shown read-only, with the reason, when it can't.
 */
export const ProfilePage = ({
  session,
  handle,
  profiles,
  collection,
  onDeleted,
}: {
  readonly session: Session;
  readonly handle: string | undefined;
  readonly profiles: Profiles;
  readonly collection: string;
  readonly onDeleted: () => void;
}) => {
  const shape = useQuery({
    queryKey: ["shape", collection],
    queryFn: ({ signal }) => fetchProfileShape(collection, signal),
    // A lexicon rarely changes, and a person moving between profiles shouldn't wait each time.
    staleTime: 60 * 60 * 1000,
    retry: 1,
  });

  if (shape.isPending)
    return <p className="text-neutral-600">Reading {nameOf(collection)}'s lexicon…</p>;

  const reason = !canRequest(collection)
    ? "omote doesn't know this app yet, so it can't ask for permission to edit its profile."
    : shape.error
      ? `omote couldn't read ${nameOf(collection)}'s lexicon, so it can't check what its profile accepts (${shape.error.message}).`
      : undefined;

  if (reason || !shape.data) {
    return (
      <div className="grid gap-8 lg:grid-cols-[1fr_20rem]">
        <div className="flex flex-col gap-2">
          <h2 className="text-xl font-semibold">{nameOf(collection)}</h2>
          <p className="text-xs text-neutral-600">{collection}</p>
          <p className="mt-2 text-sm text-neutral-700">{reason}</p>
          <p className="text-sm text-neutral-700">
            Edit this profile in {nameOf(collection)} itself.
          </p>
        </div>
        <ProfileCard
          session={session}
          handle={handle}
          collection={collection}
          resolved={resolveProfile(profiles, collection)}
        />
      </div>
    );
  }

  return (
    <ProfileEditor
      // A fresh form per profile. Saving keeps the form (it resets to what was saved), and deleting leaves the page.
      key={collection}
      session={session}
      handle={handle}
      profiles={profiles}
      collection={collection}
      shape={shape.data}
      onDeleted={onDeleted}
    />
  );
};
