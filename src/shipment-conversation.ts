export type ShipmentEvent = {
  eventId: string;
  shipmentId: string;
  kind: "shipment.delayed" | "delivery.confirmed" | "delivery.exception";
  occurredAt: string;
  note: string;
  proofOfDelivery?: { name: string; downloadUrl: string };
};

export type ExceptionDecision = {
  room: string;
  event: "shipment.exception.raised" | "shipment.delivery.recorded";
  data: ShipmentEvent;
};

export function shipmentRoom(shipmentId: string): string {
  return `shipment-${shipmentId}`;
}

export function decideShipmentUpdate(input: ShipmentEvent): ExceptionDecision {
  const hasProof = Boolean(input.proofOfDelivery?.downloadUrl);
  const event = input.kind === "delivery.confirmed" && hasProof
    ? "shipment.delivery.recorded"
    : "shipment.exception.raised";

  return { room: shipmentRoom(input.shipmentId), event, data: input };
}
