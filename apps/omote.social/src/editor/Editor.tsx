import { NSID_BASE_PROFILE } from "@omote-social/lexicon";
import { blobUrl, defaultResolver, resolveProfile } from "@omote-social/profiles";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import { Button, Form } from "react-aria-components";
import { beginSignIn, currentSession, takeReturnTo, type Session } from "../auth";
import { listProfiles } from "./api";
import { byPrecedence, nameOf } from "./collections";
import { HandleField } from "./HandleField";
import { normaliseHandle, rememberHandle } from "./handles";
import { Overview } from "./Overview";
import { buildOverview } from "./overview-model";
import { ProfilePage } from "./ProfilePage";

const queryClient = new QueryClient();

/** The editor, mounted once on the page. */
export const Editor = () => (
  <QueryClientProvider client={queryClient}>
    <SessionGate />
  </QueryClientProvider>
);

const SessionGate = () => {
  const session = useQuery({
    queryKey: ["session"],
    queryFn: async () => (await currentSession()) ?? null,
    staleTime: Infinity,
  });

  if (session.isPending) return <p className="text-neutral-600">Loading…</p>;
  if (session.error) return <SignIn problem={session.error.message} />;
  return session.data ? <Workspace session={session.data} /> : <SignIn />;
};

const SignIn = ({ problem }: { readonly problem?: string }) => {
  const [handle, setHandle] = useState("");
  const [error, setError] = useState(problem);

  return (
    <Form
      className="flex max-w-sm flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault();
        beginSignIn(normaliseHandle(handle)).catch((cause: unknown) =>
          setError((cause as Error).message),
        );
      }}
    >
      <HandleField
        value={handle}
        onChange={(value) => {
          setHandle(value);
          setError(undefined);
        }}
        error={error}
      />
      <Button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white">
        Sign in
      </Button>
    </Form>
  );
};

const tab = (active: boolean) =>
  `rounded-md px-3 py-2 text-left text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`;

/**
 * Which profile is open, kept in the URL (`?profile=`) so it survives a reload and the back button works. After `requestAccess`, the profile it was asked for reopens.
 */
const useSelection = () => {
  const [selected, setSelected] = useState<string | undefined>(
    () =>
      takeReturnTo() ?? new URLSearchParams(globalThis.location.search).get("profile") ?? undefined,
  );

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    if (selected) url.searchParams.set("profile", selected);
    else url.searchParams.delete("profile");
    if (url.href !== globalThis.location.href) globalThis.history.pushState(null, "", url);
  }, [selected]);

  useEffect(() => {
    const onPop = () =>
      setSelected(new URLSearchParams(globalThis.location.search).get("profile") ?? undefined);
    globalThis.addEventListener("popstate", onPop);
    return () => globalThis.removeEventListener("popstate", onPop);
  }, []);

  return [selected, setSelected] as const;
};

const Workspace = ({ session }: { readonly session: Session }) => {
  const handle = useQuery({
    queryKey: ["handle", session.did],
    queryFn: async () => (await defaultResolver().resolve(session.did)).handle,
  });
  const profiles = useQuery({
    queryKey: ["profiles", session.did],
    queryFn: () => listProfiles(session),
  });
  const [selected, select] = useSelection();

  // Remembered only once signed in, so a mistyped handle is never suggested back.
  useEffect(() => {
    if (handle.data && handle.data !== "handle.invalid") rememberHandle(handle.data);
  }, [handle.data]);

  // The shared base is always offered, so it can be created; every other profile only if it exists.
  const collections = profiles.data
    ? [...new Set([NSID_BASE_PROFILE, ...profiles.data.keys()])].sort(byPrecedence)
    : [];

  return (
    <div className="flex flex-col gap-8">
      <header className="flex items-center justify-between">
        <p className="text-sm text-neutral-600">
          Signed in as <b>@{handle.data ?? session.did}</b>
        </p>
        <Button
          className="text-sm underline"
          onPress={async () => {
            await session.signOut();
            await queryClient.resetQueries();
          }}
        >
          Sign out
        </Button>
      </header>

      <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
        <nav aria-label="Profiles" className="flex flex-col gap-1">
          <Button onPress={() => select(undefined)} className={tab(selected === undefined)}>
            All apps
          </Button>
          {profiles.data &&
            collections.map((collection) => {
              const avatar = resolveProfile(profiles.data, collection).fields.avatar;
              return (
                <Button
                  key={collection}
                  onPress={() => select(collection)}
                  className={`${tab(selected === collection)} flex items-center gap-2`}
                >
                  <span className="h-6 w-6 shrink-0 overflow-hidden rounded-full bg-neutral-200">
                    {typeof avatar === "object" && (
                      <img
                        src={blobUrl(session.pds, session.did, avatar)}
                        alt=""
                        className="h-full w-full object-cover"
                      />
                    )}
                  </span>
                  <span className="flex min-w-0 flex-col">
                    <span className="truncate">{nameOf(collection)}</span>
                    <span
                      className={`truncate text-xs ${selected === collection ? "text-neutral-300" : "text-neutral-500"}`}
                    >
                      {profiles.data.has(collection) ? collection : "Not created yet"}
                    </span>
                  </span>
                </Button>
              );
            })}
        </nav>

        <main className="min-w-0">
          {profiles.error ? (
            <p className="text-sm text-red-700">{profiles.error.message}</p>
          ) : !profiles.data ? (
            <p className="text-neutral-600">Loading…</p>
          ) : selected ? (
            <ProfilePage
              session={session}
              handle={handle.data}
              profiles={profiles.data}
              collection={selected}
              onDeleted={() => select(undefined)}
            />
          ) : (
            <Overview
              session={session}
              handle={handle.data}
              appearances={buildOverview(profiles.data)}
              onOpen={select}
            />
          )}
        </main>
      </div>
    </div>
  );
};
