import { decideShipmentUpdate } from "./shipment-conversation.js";

const decision = decideShipmentUpdate({
  eventId: "evt-checkout-1042",
  shipmentId: "shipment-1042",
  kind: "delivery.exception",
  occurredAt: "2026-09-16T09:15:00.000Z",
  note: "Customer selected a new delivery window at checkout support.",
});

console.log(JSON.stringify(decision, null, 2));
