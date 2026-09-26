import {
  CompositeDidDocumentResolver,
  PlcDidDocumentResolver,
  WebDidDocumentResolver,
} from "@atcute/identity-resolver";
import { DohJsonLexiconAuthorityResolver, LexiconSchemaResolver } from "@atcute/lexicon-resolver";
import type { Nsid } from "@atcute/lexicons/syntax";
import { NSID_BASE_PROFILE } from "@omote-social/lexicon";
import baseLexicon from "@omote-social/lexicon/lexicons/social/omote/actor/profile.json";
import { readProfileShape, type ProfileShape } from "./shape";

/**
 * Each app's profile lexicon, found the way the protocol publishes lexicons: a DNS record names the authority's DID, and that DID's repository holds the schema. The resolver verifies the record it fetches, so a lexicon can't be swapped in transit.
 */

const authority = new DohJsonLexiconAuthorityResolver({
  dohUrl: "https://cloudflare-dns.com/dns-query",
});
const schemas = new LexiconSchemaResolver({
  didDocumentResolver: new CompositeDidDocumentResolver({
    methods: { plc: new PlcDidDocumentResolver(), web: new WebDidDocumentResolver() },
  }),
});

/** Ours ships with the package: it is the lexicon omote itself follows, whatever DNS says. */
const BASE_SHAPE = readProfileShape(baseLexicon);

export const fetchProfileShape = async (
  collection: string,
  signal?: AbortSignal,
): Promise<ProfileShape> => {
  if (collection === NSID_BASE_PROFILE && BASE_SHAPE) return BASE_SHAPE;

  const did = await authority.resolve(collection as Nsid, { signal });
  const { rawSchema } = await schemas.resolve(did, collection as Nsid, { signal });
  const shape = readProfileShape(rawSchema);
  if (!shape) throw new Error(`${collection}'s lexicon isn't a record lexicon.`);

  return shape;
};
