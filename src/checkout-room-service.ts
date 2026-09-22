import { createServer } from "node:http";
import { z } from "zod";
import { InfraiGateway } from "./infrai-gateway.js";
import { decideShipmentUpdate, type ShipmentEvent } from "./shipment-conversation.js";

const updateSchema = z.object({
  sessionId: z.string().min(1),
  accountId: z.string().min(1),
  eventId: z.string().min(1),
  shipmentId: z.string().min(1),
  kind: z.enum(["shipment.delayed", "delivery.confirmed", "delivery.exception"]),
  occurredAt: z.string().datetime(),
  note: z.string().min(1),
  proofOfDelivery: z.object({ name: z.string().min(1), downloadUrl: z.string().url() }).optional(),
});

const gateway = new InfraiGateway();

export const server = createServer(async (request, response) => {
  if (request.method !== "POST" || request.url !== "/checkout/shipment-update") {
    response.writeHead(404).end();
    return;
  }
  const chunks: Buffer[] = [];
  for await (const chunk of request) chunks.push(chunk);
  const parsed = updateSchema.safeParse(JSON.parse(Buffer.concat(chunks).toString("utf8")));
  if (!parsed.success) {
    response.writeHead(400, { "Content-Type": "application/json" }).end(JSON.stringify({ error: parsed.error.flatten() }));
    return;
  }

  try {
    const input = parsed.data;
    const session = await gateway.verifyCheckoutSession(input.sessionId);
    const decision = decideShipmentUpdate(input as ShipmentEvent);
    await gateway.createShipmentRoom(decision.room);
    const channelToken = await gateway.issueRoomToken(session.client_id, decision.room);
    await gateway.publishShipmentUpdate(decision.room, decision.event, decision.data, input.accountId);
    response.writeHead(201, { "Content-Type": "application/json" }).end(JSON.stringify({
      room: decision.room,
      event: decision.event,
      channelToken: channelToken.token,
    }));
  } catch (error) {
    response.writeHead(422, { "Content-Type": "application/json" }).end(JSON.stringify({ error: (error as Error).message }));
  }
});

if (process.env.RUN_SERVER === "true") {
  server.listen(3000, () => console.log("Checkout shipment room service listening on http://localhost:3000"));
}
