import { contextSchema } from "@omote/lexicon";
import { defaultResolver } from "@omote/profiles";
import { QueryClient, QueryClientProvider, useQuery } from "@tanstack/react-query";
import { useState } from "react";
import {
  Button,
  FieldError,
  Form,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Text,
  TextField,
} from "react-aria-components";
import * as v from "valibot";
import { beginSignIn, currentSession, type Session } from "../auth";
import { getBase, listOverrides } from "./api";
import { OverrideEditor } from "./OverrideEditor";

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
  const base = useQuery({ queryKey: ["base", session.did], queryFn: () => getBase(session) });
  const overrides = useQuery({
    queryKey: ["overrides", session.did],
    queryFn: () => listOverrides(session),
  });
  const [selected, setSelected] = useState<string>();
  const [adding, setAdding] = useState("");
  const addingValid = v.safeParse(contextSchema, adding).success;

  const contexts = [
    ...new Set([...(overrides.data ?? []).map((o) => o.context), ...(selected ? [selected] : [])]),
  ];
  const current = overrides.data?.find((o) => o.context === selected);

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

      {!base.isPending && !base.data && (
        <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
          You have no base profile yet, so apps show you by your handle unless you customise them
          here.
        </p>
      )}

      <div className="grid gap-8 md:grid-cols-[14rem_1fr]">
        <nav className="flex flex-col gap-4">
          <ListBox
            aria-label="Apps you've customised"
            selectionMode="single"
            selectedKeys={selected ? [selected] : []}
            onSelectionChange={(keys) => {
              const [key] = [...(keys as Set<string>)];
              setSelected(key);
            }}
            renderEmptyState={() => (
              <p className="text-sm text-neutral-600">No apps customised yet.</p>
            )}
            className="flex flex-col gap-1"
          >
            {contexts.map((context) => (
              <ListBoxItem
                key={context}
                id={context}
                className="cursor-pointer rounded-md px-3 py-2 text-sm data-[focus-visible]:outline-2 data-[selected]:bg-neutral-900 data-[selected]:text-white"
              >
                {context}
              </ListBoxItem>
            ))}
          </ListBox>
          <Form
            className="flex flex-col gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!addingValid) return;
              setSelected(adding);
              setAdding("");
            }}
          >
            <TextField
              value={adding}
              onChange={setAdding}
              isInvalid={adding !== "" && !addingValid}
              className="flex flex-col gap-1"
            >
              <Label className="text-sm font-medium">Customise another app</Label>
              <Input
                placeholder="social.taproom"
                className="rounded-md border border-neutral-300 px-3 py-2"
              />
              <Text slot="description" className="text-xs text-neutral-600">
                The app's reversed domain, e.g. social.taproom for taproom.social.
              </Text>
              <FieldError className="text-xs text-red-700">
                Use the app's reversed domain, like social.taproom.
              </FieldError>
            </TextField>
            <Button
              type="submit"
              isDisabled={!addingValid}
              className="rounded-md border border-neutral-300 px-3 py-2 text-sm disabled:opacity-60"
            >
              Add
            </Button>
          </Form>
        </nav>

        <main>
          {selected && !overrides.isPending && !base.isPending ? (
            <OverrideEditor
              key={selected}
              session={session}
              handle={handle.data}
              context={selected}
              base={base.data}
              existing={current?.record}
              problem={current?.problem}
              onDeleted={() => setSelected(undefined)}
            />
          ) : (
            <p className="text-neutral-600">Pick an app to change how you appear there.</p>
          )}
          {(overrides.error ?? base.error) && (
            <p className="text-sm text-red-700">{(overrides.error ?? base.error)?.message}</p>
          )}
        </main>
      </div>
    </div>
  );
};
