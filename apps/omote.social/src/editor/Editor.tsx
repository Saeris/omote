import { NSID_BASE_PROFILE } from "@omote-social/lexicon";
import { blobUrl, defaultResolver, resolveProfile } from "@omote-social/profiles";
import {
  MutationCache,
  QueryCache,
  QueryClient,
  QueryClientProvider,
  useQuery,
} from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { Button, Form } from "react-aria-components";
import {
  beginSignIn,
  currentSession,
  endSession,
  endedSession,
  takeReturnTo,
  type Session,
} from "../auth";
import { listProfiles } from "./api";
import { byPrecedence, nameOf } from "./collections";
import { DiscardDialog } from "./DiscardDialog";
import { HandleField } from "./HandleField";
import { normaliseHandle, rememberHandle } from "./handles";
import { Overview } from "./Overview";
import { buildOverview } from "./overview-model";
import { ProfilePage } from "./ProfilePage";

const ENDED = "Your session ended. Sign in again to carry on.";

/**
 * A session that has ended stays ended: retrying only makes the page wait. Any read or write that finds it so drops the session and returns to sign-in, saying why.
 */
const onError = (error: unknown) => {
  const did = endedSession(error);
  if (!did) return;
  endSession(did);
  queryClient.setQueryData(["ended"], true);
  queryClient.setQueryData(["session"], null);
};

const queryClient = new QueryClient({
  queryCache: new QueryCache({ onError }),
  mutationCache: new MutationCache({ onError }),
  defaultOptions: {
    queries: { retry: (failures, error) => !endedSession(error) && failures < 3 },
  },
});

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
  const ended = useQuery({ queryKey: ["ended"], queryFn: () => false, staleTime: Infinity });

  if (session.isPending) return <p className="text-neutral-600">Loading…</p>;
  if (session.error) return <SignIn problem={session.error.message} />;
  if (session.data) return <Workspace session={session.data} />;
  return <SignIn problem={ended.data ? ENDED : undefined} />;
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

/** Where the person is going when they leave a profile. */
type Leave =
  | { readonly kind: "select"; readonly target: string | undefined }
  | { readonly kind: "signOut" };

const tab = (active: boolean) =>
  `rounded-md px-3 py-2 text-left text-sm ${active ? "bg-neutral-900 text-white" : "hover:bg-neutral-100"}`;

/**
 * Which profile is open, kept in the URL (`?profile=`) so it survives a reload and the back button works. After `requestAccess`, the profile it was asked for reopens.
 */
const profileIn = (search: string) => new URLSearchParams(search).get("profile") ?? undefined;

const useSelection = (
  onBlockedBack: (target: string | undefined) => void,
  blocked: () => boolean,
) => {
  const [selected, setSelected] = useState<string | undefined>(
    () => takeReturnTo() ?? profileIn(globalThis.location.search),
  );
  const current = useRef(selected);
  current.current = selected;

  useEffect(() => {
    const url = new URL(globalThis.location.href);
    if (selected) url.searchParams.set("profile", selected);
    else url.searchParams.delete("profile");
    if (url.href !== globalThis.location.href) globalThis.history.pushState(null, "", url);
  }, [selected]);

  useEffect(() => {
    const onPop = () => {
      const target = profileIn(globalThis.location.search);
      if (!blocked()) {
        setSelected(target);
        return;
      }
      // The browser has already moved: put the page back where it was, then ask.
      const url = new URL(globalThis.location.href);
      if (current.current) url.searchParams.set("profile", current.current);
      else url.searchParams.delete("profile");
      globalThis.history.pushState(null, "", url);
      onBlockedBack(target);
    };
    globalThis.addEventListener("popstate", onPop);
    return () => globalThis.removeEventListener("popstate", onPop);
  }, [blocked, onBlockedBack]);

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

  // Unsaved changes in the open profile, and where the person was trying to go when asked about them.
  const [dirty, setDirty] = useState(false);
  const dirtyRef = useRef(dirty);
  dirtyRef.current = dirty;
  const [leaving, setLeaving] = useState<Leave>();
  const blocked = useCallback(() => dirtyRef.current, []);
  const onBlockedBack = useCallback(
    (target: string | undefined) => setLeaving({ kind: "select", target }),
    [],
  );
  const [selected, setSelected] = useSelection(onBlockedBack, blocked);

  const signOut = async () => {
    await session.signOut();
    await queryClient.resetQueries();
  };
  const go = (leave: Leave) => {
    setDirty(false);
    if (leave.kind === "select") setSelected(leave.target);
    else void signOut();
  };
  /** Leave the open profile, asking first if that would lose changes. */
  const leave = (next: Leave) => (dirtyRef.current ? setLeaving(next) : go(next));
  const select = (target: string | undefined) => {
    if (target !== selected) leave({ kind: "select", target });
  };

  // Reloading or closing the tab can't show our dialog; the browser asks instead.
  useEffect(() => {
    if (!dirty) return;
    const onBeforeUnload = (event: BeforeUnloadEvent) => event.preventDefault();
    globalThis.addEventListener("beforeunload", onBeforeUnload);
    return () => globalThis.removeEventListener("beforeunload", onBeforeUnload);
  }, [dirty]);

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
        <Button className="text-sm underline" onPress={() => leave({ kind: "signOut" })}>
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
              onDeleted={() => go({ kind: "select", target: undefined })}
              onDirtyChange={setDirty}
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

      {leaving && selected && (
        <DiscardDialog
          profile={nameOf(selected)}
          onKeep={() => setLeaving(undefined)}
          onDiscard={() => {
            setLeaving(undefined);
            go(leaving);
          }}
        />
      )}
    </div>
  );
};
