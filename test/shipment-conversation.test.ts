import assert from "node:assert/strict";
import test from "node:test";
import { decideShipmentUpdate } from "../src/shipment-conversation.js";

test("confirmed delivery with proof is recorded instead of opening an exception", () => {
  const result = decideShipmentUpdate({
    eventId: "evt-55",
    shipmentId: "order-55",
    kind: "delivery.confirmed",
    occurredAt: "2026-09-16T09:15:00.000Z",
    note: "Receipt attached by the carrier.",
    proofOfDelivery: { name: "receipt.jpg", downloadUrl: "https://files.example.test/receipt.jpg" },
  });

  assert.equal(result.room, "shipment-order-55");
  assert.equal(result.event, "shipment.delivery.recorded");
});
