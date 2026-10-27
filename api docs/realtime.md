# Realtime WebSocket Client Examples (Socket.IO)

This file provides ready-to-copy client-side examples for connecting and interacting with the `@bts-soft/nest-starter` WebSocket Gateway (`/realtime`).

---

## 1. Connection Examples

### Client Connection (JavaScript / TypeScript - `socket.io-client`)

```typescript
import { io, Socket } from 'socket.io-client';

const socket: Socket = io('http://localhost:3000', {
  path: '/realtime',
  auth: {
    token: 'YOUR_JWT_ACCESS_TOKEN_HERE',
  },
  query: {
    lang: 'en', // 'en' | 'ar'
  },
  transports: ['websocket', 'polling'],
});

// Connection lifecycle listeners
socket.on('connect', () => {
  console.log('Socket connected! ID:', socket.id);
});

socket.on('connection_established', (envelope) => {
  console.log('Connection greeting received:', envelope);
  // Example envelope:
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "Joined room successfully",
  //   timestamp: "2026-10-27T15:00:00.000Z",
  //   event: "connection_established",
  //   data: { userId: "user-1", socketId: "xyz..." }
  // }
});

socket.on('disconnect', (reason) => {
  console.log('Disconnected:', reason);
});

socket.on('exception', (errorEnvelope) => {
  console.error('Realtime exception received:', errorEnvelope);
  // Example error envelope:
  // {
  //   success: true,
  //   statusCode: 400,
  //   message: "Validation failed for the received message",
  //   timestamp: "2026-10-27T15:00:00.000Z",
  //   event: "exception",
  //   data: {
  //     success: false,
  //     statusCode: 400,
  //     message: "Validation failed for the received message",
  //     timestamp: "2026-10-27T15:00:00.000Z",
  //     code: "VALIDATION_ERROR",
  //     details: { room: ["The room field is required"] }
  //   }
  // }
});
```

---

## 2. Client Inbound Events (Emit from Client -> Server)

### 2.1 Heartbeat (`ping`)
Send periodic ping to keep the connection alive (at least once every 60s):
```typescript
socket.emit('ping');

socket.on('pong', (envelope) => {
  console.log('Received pong:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "pong",
  //   data: null
  // }
});
```

### 2.2 Join Room (`join_room`)
Join a collaborative room or topic channel:
```typescript
// Payload: RoomDto
socket.emit('join_room', {
  room: 'support-chat-101',
});

socket.on('room_joined', (envelope) => {
  console.log('Room joined:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "room_joined",
  //   data: {
  //     room: "support-chat-101",
  //     message: "Joined room successfully"
  //   }
  // }
});
```

### 2.3 Leave Room (`leave_room`)
Leave a room:
```typescript
// Payload: RoomDto
socket.emit('leave_room', {
  room: 'support-chat-101',
});

socket.on('room_left', (envelope) => {
  console.log('Room left:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "room_left",
  //   data: {
  //     room: "support-chat-101",
  //     message: "Left room successfully"
  //   }
  // }
});
```

### 2.4 Send Room Message (`send_room_message`)
Broadcast a message to everyone else in the room (excludes the sender):
```typescript
// Payload: SendRoomMessageDto
socket.emit('send_room_message', {
  room: 'support-chat-101',
  message: 'Hello everyone!',
  data: {
    type: 'text',
    attachmentUrl: null,
  },
});
```

### 2.5 Query User Presence (`get_presence`)
Query the online status, active connection count, and last seen timestamp of any user:
```typescript
// Payload: GetPresenceDto
socket.emit('get_presence', {
  userId: '372342399391995648',
});

socket.on('presence', (envelope) => {
  console.log('User presence status:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "presence",
  //   data: {
  //     userId: "372342399391995648",
  //     isOnline: true,
  //     connectionsCount: 2,
  //     lastSeenAt: "2026-10-27T15:00:00.000Z"
  //   }
  // }
});
```

---

## 3. Server Outbound Events (Listen on Client <- Server)

### 3.1 Room Messages (`room_message`)
Received when another client in the room calls `send_room_message`:
```typescript
socket.on('room_message', (envelope) => {
  console.log('Received room message:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "room_message",
  //   data: {
  //     room: "support-chat-101",
  //     senderId: "user-sender-id",
  //     senderEmail: "sender@example.com",
  //     message: "Hello everyone!",
  //     data: { type: "text", attachmentUrl: null }
  //   }
  // }
});
```

### 3.2 User Offline Broadcast (`user_offline`)
Emitted on the user's private room `user:{userId}` when their last connection disconnects:
```typescript
socket.on('user_offline', (envelope) => {
  console.log('User went offline:', envelope);
  // {
  //   success: true,
  //   statusCode: 200,
  //   message: "",
  //   timestamp: "...",
  //   event: "user_offline",
  //   data: { userId: "user-123" }
  // }
});
```

---

## 4. Server-Side Pushes (NestJS Backend Usage)

Inject `RealtimeService` in any provider, command, or resolver:

```typescript
import { Injectable } from '@nestjs/common';
import { RealtimeService } from '../realtime/services/realtime.service.js';

@Injectable()
export class NotificationDeliveryService {
  constructor(private readonly realtimeService: RealtimeService) {}

  async notifyUser(userId: string, notification: Record<string, unknown>) {
    // Delivers to the user's private room: user:{userId}
    const delivered = await this.realtimeService.emitToUser(
      userId,
      'notification_received',
      notification,
    );
    if (!delivered) {
      console.log('User is offline, fallback to push/email');
    }
  }

  async broadcastMaintenance(window: string) {
    // Delivers to all connected sockets across the entire cluster
    this.realtimeService.broadcast('system_alert', {
      type: 'maintenance',
      window,
    });
  }

  async updateRoom(roomId: string, data: unknown) {
    // Delivers to all sockets joined to the room
    this.realtimeService.emitToRoom(roomId, 'room_updated', data);
  }
}
```
