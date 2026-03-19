---
title: 'Building Real-Time Features with WebSockets in a NestJS Monorepo'
description: 'Architecture patterns for adding live updates, presence indicators, and collaborative features to a production NestJS application.'
date: '2026-02-08'
category: 'Technical'
author: 'Booking OS Team'
readTime: '7 min read'
---

Real-time features transform a booking platform from a static tool into a living workspace. Live inbox updates, presence indicators showing who's viewing a conversation, and instant booking notifications create an experience that feels responsive and collaborative. Here's how we built it.

## Choosing Socket.io Over Raw WebSockets

Raw WebSockets are simple but lack features you'll inevitably need: automatic reconnection, room-based broadcasting, binary data support, and graceful fallback to HTTP long-polling for restrictive network environments.

Socket.io provides all of these out of the box with a battle-tested client library. NestJS has first-class support via the `@nestjs/websockets` and `@nestjs/platform-socket.io` packages, making the integration straightforward.

## Gateway Architecture

In NestJS, WebSocket logic lives in Gateways — classes decorated with `@WebSocketGateway()`. We use a single gateway with namespace-based routing rather than multiple gateways, keeping the connection overhead minimal for clients.

```
Events flow:
Service → Gateway → Room broadcast → Connected clients
```

Each business tenant gets its own Socket.io room, ensuring strict data isolation. When a message arrives for Business A, only clients connected to Business A's room receive the update.

## Key Event Patterns

### Fire-and-Forget Broadcasts

Most real-time events are simple broadcasts: a new message arrived, a booking was updated, an AI suggestion was generated. The service responsible for the change emits an event through the gateway, and all connected clients in the relevant room receive it.

```
message:new → all agents viewing the inbox
booking:updated → calendar views refresh
ai:suggestion → conversation panel shows the draft
```

### Presence and Viewing State

Presence is bidirectional. Clients emit `viewing:start` when they open a conversation and `viewing:stop` when they leave. The gateway tracks who's viewing what, broadcasting `presence:update` events so other agents see "Sarah is viewing this conversation" indicators.

This prevents two agents from responding to the same client simultaneously — a common pain point in team inbox tools.

### Optimistic Updates with Reconciliation

For actions like sending a message, the client optimistically updates the UI immediately, then listens for the server-confirmed event. If the server event differs (message ID, timestamp, or failure), the client reconciles. This pattern makes the app feel instant while maintaining data integrity.

## Authentication and Security

WebSocket connections authenticate using the same JWT token as REST requests. The token is sent during the handshake, validated in a custom middleware, and the decoded user is attached to the socket for the duration of the connection.

Expired tokens trigger a disconnect event with a specific code, prompting the client to refresh the token and reconnect automatically.

## Scaling with Redis Adapter

In a single-server deployment, Socket.io's in-memory adapter works fine. But once you scale to multiple server instances behind a load balancer, clients connected to Server A won't receive events emitted from Server B.

The `@socket.io/redis-adapter` solves this by using Redis pub/sub to synchronize events across all server instances. Every event emitted on any server is published to Redis and delivered to clients on all servers. The switch is a single configuration change with no application code modifications.

## Client-Side Patterns

On the frontend, a singleton socket manager handles connection lifecycle, automatic reconnection, and event subscription. React components subscribe to specific events via a custom hook and unsubscribe on unmount, preventing memory leaks and stale handlers.

Connection state (connected, disconnected, reconnecting) is surfaced in the UI so users know when they might be seeing stale data. A small banner appears during reconnection attempts and disappears once the connection is restored.

## Lessons Learned

**Don't over-emit.** Broadcasting every minor state change creates unnecessary renders and network traffic. Batch related updates and debounce rapid-fire events.

**Test with realistic latency.** Real-time features feel great on localhost. Add network throttling during development to catch race conditions and ordering issues early.

**Log strategically.** WebSocket events are high-volume. Log connection/disconnection events and errors, but use sampling or structured logging for message-level events to avoid drowning your log storage.
