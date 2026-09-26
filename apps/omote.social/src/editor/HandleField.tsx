import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ComboBox,
  FieldError,
  Input,
  Label,
  ListBox,
  ListBoxItem,
  Popover,
  Text,
} from "react-aria-components";
import {
  MIN_QUERY,
  normaliseHandle,
  rememberedHandles,
  searchHandles,
  suggest,
  type Suggestion,
} from "./handles";

/** The value, once it has stopped changing for `delay` milliseconds: one Bluesky lookup per pause, not per keystroke. */
const useSettled = <T,>(value: T, delay: number): T => {
  const [settled, setSettled] = useState(value);
  useEffect(() => {
    const timer = setTimeout(() => setSettled(value), delay);
    return () => clearTimeout(timer);
  }, [value, delay]);
  return settled;
};

/**
 * The sign-in handle field: a combobox that suggests handles, and still accepts any handle typed in full.
 */
export const HandleField = ({
  value,
  onChange,
  error,
}: {
  readonly value: string;
  readonly onChange: (value: string) => void;
  readonly error: string | undefined;
}) => {
  const [remembered] = useState(rememberedHandles);
  const query = useSettled(normaliseHandle(value), 200);
  const asking = query.length >= MIN_QUERY;
  const found = useQuery({
    queryKey: ["typeahead", query],
    queryFn: ({ signal }) => searchHandles(query, signal),
    enabled: asking,
    staleTime: 60_000,
    placeholderData: keepPreviousData,
  });
  const items = suggest(value, remembered, asking ? (found.data ?? []) : []);

  return (
    <ComboBox
      inputValue={value}
      onInputChange={onChange}
      onSelectionChange={(key) => key !== null && onChange(String(key))}
      items={items}
      allowsCustomValue
      // Bluesky's suggestions arrive after the keystroke that opens the list, and a
      // combobox that won't open while empty would never show them.
      allowsEmptyCollection
      menuTrigger="focus"
      isRequired
      isInvalid={Boolean(error)}
      className="flex flex-col gap-1"
    >
      <Label className="text-sm font-medium">Your handle</Label>
      <Input
        placeholder="you.bsky.social"
        autoCapitalize="none"
        autoCorrect="off"
        spellCheck={false}
        className="rounded-md border border-neutral-300 px-3 py-2"
      />
      <Text slot="description" className="text-xs text-neutral-600">
        Any ATProto account works. You'll confirm on your own server. After two characters,
        suggestions come from Bluesky's directory.
      </Text>
      <FieldError className="text-xs text-red-700">{error}</FieldError>
      <Popover className="w-(--trigger-width) overflow-auto rounded-md border border-neutral-200 bg-white shadow-lg">
        <ListBox<Suggestion>
          className="max-h-72 outline-none"
          renderEmptyState={() => (
            <p className="px-3 py-2 text-sm text-neutral-600">
              {!asking
                ? "Type two characters for suggestions."
                : found.isFetching
                  ? "Looking…"
                  : "No suggestions. Your full handle works too."}
            </p>
          )}
        >
          {(item) => (
            <ListBoxItem
              id={item.handle}
              textValue={item.handle}
              className="flex cursor-pointer items-center gap-3 px-3 py-2 text-sm outline-none data-[focused]:bg-neutral-100"
            >
              {item.avatar ? (
                <img
                  src={item.avatar}
                  alt=""
                  className="h-7 w-7 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span aria-hidden className="h-7 w-7 shrink-0 rounded-full bg-neutral-200" />
              )}
              <span className="flex min-w-0 flex-col">
                {item.displayName && (
                  <span className="truncate font-medium">{item.displayName}</span>
                )}
                <span className="truncate text-neutral-600">@{item.handle}</span>
              </span>
              {item.remembered && (
                <span className="ml-auto shrink-0 text-xs text-neutral-500">Used here before</span>
              )}
            </ListBoxItem>
          )}
        </ListBox>
      </Popover>
    </ComboBox>
  );
};
