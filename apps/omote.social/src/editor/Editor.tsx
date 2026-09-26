import { defaultResolver } from "@omote-social/profiles";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Button, FieldError, Form, Input, Label, Text, TextField } from "react-aria-components";
import { beginSignIn, currentSession, type Session } from "../auth";
import { listProfiles } from "./api";
import { BaseEditor } from "./BaseEditor";
import { Overview } from "./Overview";
import { buildOverview } from "./overview-model";

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
        beginSignIn(handle.trim().replace(/^@/u, "")).catch((cause: unknown) =>
          setError((cause as Error).message),
        );
      }}
    >
      <TextField
        value={handle}
        onChange={setHandle}
        isRequired
        isInvalid={Boolean(error)}
        className="flex flex-col gap-1"
      >
        <Label className="text-sm font-medium">Your handle</Label>
        <Input
          placeholder="you.bsky.social"
          className="rounded-md border border-neutral-300 px-3 py-2"
        />
        <Text slot="description" className="text-xs text-neutral-600">
          Any ATProto account works. You'll confirm on your own server.
        </Text>
        <FieldError className="text-xs text-red-700">{error}</FieldError>
      </TextField>
      <Button type="submit" className="rounded-md bg-neutral-900 px-4 py-2 font-medium text-white">
        Sign in
      </Button>
    </Form>
  );
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
  const [editing, setEditing] = useState(false);

  const tab = (active: boolean) =>
    `rounded-md px-3 py-2 text-left text-sm ${active ? "bg-neutral-900 text-white" : ""}`;

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
        <nav className="flex flex-col gap-1">
          <Button onPress={() => setEditing(false)} className={tab(!editing)}>
            All apps
          </Button>
          <Button onPress={() => setEditing(true)} className={tab(editing)}>
            Shared profile
          </Button>
        </nav>

        <main>
          {profiles.error ? (
            <p className="text-sm text-red-700">{profiles.error.message}</p>
          ) : !profiles.data ? (
            <p className="text-neutral-600">Loading…</p>
          ) : editing ? (
            <BaseEditor
              session={session}
              handle={handle.data}
              profiles={profiles.data}
              onDeleted={() => setEditing(false)}
            />
          ) : (
            <Overview
              session={session}
              columns={buildOverview(profiles.data)}
              onEditBase={() => setEditing(true)}
            />
          )}
        </main>
      </div>
    </div>
  );
};
