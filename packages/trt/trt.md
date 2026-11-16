# trt

`trt` calls the Turtle API beyond Sonar: billing, streams, engagement campaigns, products,
and whatever the API adds later. Its commands come from the API's own spec, so nothing here
lists them: ask `trt`.

- `trt --help`: the products. `trt <product> --help`: their commands.
- `trt <product> <resource> <method> --help`: what a call does and its flags.
- `trt schema <product.resource.method>`: its parameters, body and response, as JSON. Read
  it before a write.

A call is `trt <product> <resource> <method> --<param> <value> …`, e.g.
`trt billing invoices list --limit 10`. Your organization is filled in for you; `--org <id>`
names another. A body is `--json '<json>'` or `--json @file`. A flag the call does not take
is refused.

- A GET runs. A POST, PUT, PATCH or DELETE is only printed (`"sent": false`) until you add
  `--yes`. `--dry-run` prints any call and sends nothing.
- stdout is JSON: the response, or `{"status", "error"}` with a non-zero exit (1 the API
  said no, 2 the command is wrong, 3 the API could not be reached).
- `--page-all` prints one JSON line per page, 10 pages at most (`--page-limit <n>`).

The key is your member's, held to this organization: you reach what they may reach in it
where the API takes a personal key (Sonar, billing, streams, engagement campaigns), and the
public reads. Anything else answers 401. For Sonar keep to `sonar api`, whose doc says what
a write there must carry.
