# Turtle Kit

Turtle Kit is the developer-facing package family for integrating with Turtle Earn. Its language distinguishes the public SDK contract from generated or internal API capabilities.

## Language

**SDK Surface**:
The public set of Turtle Earn operations exported by the TypeScript SDK. The SDK Surface is the upper bound for API-backed MCP tools: an operation outside it is not available to the MCP.
_Avoid_: Full OpenAPI schema, backend API, generated client internals

**SDK Operation**:
An API operation exposed as a callable function in the SDK Surface. SDK Operations are eligible for MCP tools; SDK configuration helpers, clients, namespaces, and type exports are not.
_Avoid_: SDK export, helper, generated type

**SDK Schema Surface**:
The validation schemas exposed by the SDK for consumers that derive integrations from SDK Operations. The SDK Schema Surface supports the MCP Tool Surface but does not expand which operations are available.
_Avoid_: Internal generated schema, OpenAPI schema source

**MCP Tool Surface**:
The set of MCP tools exposed to agent clients. For API-backed tools, it is derived from the SDK Surface rather than directly from the full OpenAPI schema.
_Avoid_: OpenAPI tools, raw endpoint tools

**MCP Update**:
The refresh step that reconciles the MCP Tool Surface with the current SDK Surface before development builds or package publishing. The MCP Update is a generation-time activity, not runtime discovery.
_Avoid_: Runtime introspection, dynamic tool discovery

**MCP MVP**:
The first local `packages/mcp` package that exposes SDK Operations as MCP tools. Publication naming, package migration compatibility, and non-SDK capabilities are outside the MCP MVP.
_Avoid_: Published MCP package, legacy MCP migration

**Wallet Capability**:
Agent-facing wallet connection or transaction-signing behavior that is not part of the SDK Surface. Wallet Capability is outside the MCP Tool Surface for the SDK-derived MCP package.
_Avoid_: SDK tool, generated MCP tool

**SDK-Derived Tool Name**:
The MCP tool name formed from the corresponding SDK export name using MCP-friendly casing. It preserves traceability to the SDK operation rather than optimizing first for short conversational names.
_Avoid_: Hand-picked aliases, legacy MCP names

## Example Dialogue

Dev: "OpenAPI has a new operation. Should the MCP expose it?"

Domain expert: "Only after it appears in the SDK Surface. The MCP Tool Surface cannot exceed what the SDK exports."

Dev: "Should every SDK export become an MCP tool?"

Domain expert: "No. Every SDK Operation should become an MCP tool, but helper exports and type exports are not SDK Operations."

Dev: "Can the MCP use generated validation schemas from the SDK?"

Domain expert: "Yes, through the SDK Schema Surface. Those schemas support SDK Operations but do not create new MCP tools."

Dev: "When do MCP tools change after the SDK changes?"

Domain expert: "During MCP Update. The server should run from the generated MCP Tool Surface, not discover tools at runtime."

Dev: "Should the SDK-derived MCP include wallet connection or signing tools?"

Domain expert: "No. Wallet Capability is outside this MCP Tool Surface unless a separate package or explicit opt-in surface is defined later."

Dev: "Should the deposit tool be called create_deposit or create_deposit_interaction?"

Domain expert: "Use the SDK-Derived Tool Name, so the MCP name tracks the SDK export it wraps."
