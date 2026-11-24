---
kind: instruction
load: always
---
# trt

`trt` calls the Turtle API: Sonar, billing, streams, engagement campaigns, outreach, the
organization's own figures, Turtle's market data, and whatever the API opens to a person's key
later. Its commands come from the API's own spec, so nothing here lists them: ask `trt`.

- `trt --help`: the products. `trt <product> --help`: their commands, one line each, so
  `trt billing --help 2>&1 | grep -i invoice` finds a call by a word.
- `trt <product> <resource> <method> --help`: what a call does and its flags.
- `trt schema <the command's words>`, e.g. `trt schema streams drafts create`: its
  parameters, body and response, as JSON. Read it before a write, and before you pick fields
  out of an answer.

The help and the schema are the whole of `trt`. Its code and the spec it caches say nothing
more, so never read them: a question goes to `--help`, never to `cli/`, `~/.cache/trt` or the
spec's `paths`.

A call is `trt <product> <resource> <method> --<param> <value> …`, e.g.
`trt billing invoices list --limit 10`. Your organization is filled in for you, and it is the
only one the key reaches: `--org` naming another answers 401. `billing` is this organization
as a client: what the issuers that bill it charge it. A body is `--json '<json>'` or
`--json @file`. A flag the call does not take is refused.

- A GET runs. A POST, PUT, PATCH or DELETE is only printed (`"sent": false`) until you add
  `--yes`. `--dry-run` prints any call and sends nothing.
- stdout is JSON: the response, or `{"status", "error"}` with a non-zero exit (1 the API
  said no, 2 the command is wrong, 3 the API could not be reached).
- `--page-all` prints one JSON line per page, 10 pages at most (`--page-limit <n>`).
- An answer can run to 100 kB, and all you print stays with you for the rest of the turn.
  Pick what the question needs in the same call: `trt … | jq '<fields>'`, after the schema
  told you their names.

The key is your member's, held to this organization: you reach what they may reach in it
where the API takes a personal key, and nothing else. That is Sonar, billing, streams,
engagement campaigns; `outreach`, the search for wallets to pitch (LPs; a search is charged to
the organization's credits), its chats and cohorts; the organization's deals, inflows and
outflows, activity, payouts and members; and `turtle`, the public market data: what is live
(opportunities, products), tokens, prices, leaderboards. Outreach is read-only here: sending a
message, to a wallet or a cohort, stays with your member. A Turtle admin's key reaches `admin`
too: the platform's own figures, Turtle's revenue and every client's invoices among them. `trt
--help` lists `admin` only when your member is one; when it is not listed and the answer
lives only there, say that their key does not reach it, and stop rather than build the
figure from other sources.

`trt` lists only what the key reaches, so a product it lacks may still exist. What the
organization's products are, what they do and who owns them is in its docs and skills under
`shared/`, when it has them: read those first for a question about a product, and call one
`trt` lacks a product you cannot reach from here, never one that does not exist.

`trt sonar` is the CRM `sonar api` reads, Sonar v1 at `sonar.turtle.xyz/v1`, found by name:
`trt sonar --help 2>&1 | grep -i <word>` names its calls, and they print JSON for `jq`. Never
guess a `sonar api` path: one the API lacks answers 404.

## What each product knows

Each product answers in its own ways, and nothing here says which call answers which
question: the help names the calls, not what they mean. That is learned, and kept where
every agent here reads it.

- Before you explore a product, read its skill if there is one: `shared/skills/trt-<product>.md`,
  the file `"$(dirname "$(command -v trt)")/../../shared/skills/trt-<product>.md"`.
- When a call answered a question and your member took the answer, or corrected it into
  one that holds, write down how in that skill, a `kind: skill`, `load: lazy` doc whose
  `description` names the questions it answers: the question, the call with its flags, the
  fields that carry the answer and what they mean, and what did not work. Rewrite an entry
  that changed rather than adding one beside it.
- A skill holds how, never what: no amounts, names or ids from your member's answers, which
  stay in their room.
- Check what you report: each figure says which call gave it, and the parts add up to the
  total you give.
