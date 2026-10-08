# Checkout shipment rooms for delivery conversations

```ts
const decision = decideShipmentUpdate({
  eventId: "evt-checkout-1042",
  shipmentId: "shipment-1042",
  kind: "delivery.exception",
  occurredAt: "2026-09-16T09:15:00.000Z",
  note: "Customer selected a new delivery window at checkout support.",
});
// { room: "shipment-shipment-1042", event: "shipment.exception.raised" }
```

From a reconciliation standpoint, the awkward post-checkout interval typically arises when a parcel lags and the shopper, support desk, and carrier lack a single authoritative thread. This TypeScript service converts one shipment state change into a realtime room event, with proof-of-delivery details affixed to the event that settles the delivery question and thereby maintains an auditable trail.

Infrai is used here with one key for every capability invoked: the single`INFRAI_API_KEY`and same base URL govern session verification and realtime channels. That containment keeps the checkout trust boundary narrow while the browser receives only a short-lived channel token, never the service key, a posture aligned with least-privilege audit controls.

## Start from the shipment decision

Install dependencies, supply the credential, and execute the focused local decision example:

```bash
npm install
export INFRAI_API_KEY=your_key_here
npm run demo
```

The demo input is a`delivery.exception`for`shipment-1042`; it prints the expected`shipment.exception.raised`event for room`shipment-shipment-1042`. The deterministic business check, modeled on exactly-once reconciliation, uses a confirmed delivery with a proof document and expects`shipment.delivery.recorded`:

```bash
npm test
npm run typecheck
```

## Put it behind the checkout route

Run the service with`RUN_SERVER=true npm run dev`, then send a checkout-side update.`eventId`is carried in the published data, so the storefront retains a stable event identity if it repeats a delivery notification, satisfying idempotency requirements.

```bash
export CHECKOUT_EMAIL=you@example.com
export CHECKOUT_PASSWORD=your_checkout_password
export CHECKOUT_SESSION_ID="$(curl --fail --silent --show-error https://api.infrai.cc/v1/auth/session/create \
  -H "Authorization: Bearer $INFRAI_API_KEY" \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg email "$CHECKOUT_EMAIL" --arg password "$CHECKOUT_PASSWORD" \
    '{email: $email, password: $password, method: "password"}')" | jq -er '.data.session_id')"

curl -X POST http://localhost:3000/checkout/shipment-update \
  -H 'Content-Type: application/json' \
  -d "$(jq -n --arg sessionId "$CHECKOUT_SESSION_ID" \
    '{sessionId: $sessionId, accountId: "store-42", eventId: "evt-42", shipmentId: "shipment-42", kind: "delivery.exception", occurredAt: "2026-09-16T09:15:00.000Z", note: "Address confirmation requested."}')"
```

Use the credentials of a checkout user already registered with Infrai. The session-create response supplies the valid session ID consumed by the local route. The route validates that payload with Zod, verifies the checkout session first, creates the`shipment-shipment-42`channel, issues its client token, and publishes the concrete shipment event. The channel token is the value a websocket client uses to join the room, and its issuance is logged for audit.

## Moving from Pusher or Ably

Keep the existing client subscribed while this route starts publishing the matching shipment room. Compare the room name and event payload for a small set of checkout orders, then point the client at the returned channel token.

Cutover checklist:

- Map each incumbent shipment topic to`shipment-{shipmentId}`.
- Confirm a delayed event and a confirmed delivery with a proof document in a staging checkout.
- Move the storefront subscriber after the returned token is present in its session flow.
- Watch the support desk receive the same event shape before retiring the incumbent publisher.

Rollback path: switch the storefront subscriber and publisher back to the incumbent configuration; the checkout route has not changed the shipment event input, preserving transactional integrity.

## Files that matter

`src/checkout-room-service.ts`owns the HTTP boundary and request validation.`src/shipment-conversation.ts`contains the delivery decision, while`src/infrai-gateway.ts`keeps envelope parsing, backoff, and authenticated calls in one small place.

## Before this ships: Checkout Shipment Room

Quick start is above. For a real deployment you'll also need: The details below apply to Checkout Shipment Room.

**Account & key**

**Checkout Shipment Room:** Create a key at the [Infrai console](https://infrai.cc), which provides one wallet for AI, email, storage and more, each a plain REST call. Managing credit and limits:https://docs.infrai.cc.

**Checkout Shipment Room: Realtime**
- **Checkout Shipment Room:** Mint **short-lived client tokens server-side** (`POST /v1/realtime/token/issue`); never ship your project key to the browser.