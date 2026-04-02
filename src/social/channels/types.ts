/**
 * OpenClaw message and gateway types.
 *
 * Based on OpenClaw Gateway Protocol v3:
 * - MsgContext: Normalized message from any channel
 * - ConnectParams/HelloOk: WebSocket handshake
 * - GatewayFrame: Generic gateway protocol frame
 */

/** Normalized message from any OpenClaw channel (WeChat, Telegram, Discord, etc.) */
export interface OpenClawMessage {
  Body: string;
  BodyForAgent?: string;
  Channel: string;         // "telegram" | "discord" | "wechat" | "slack" | ...
  From: string;            // sender ID (platform-specific)
  FromName?: string;       // sender display name
  To: string;              // recipient ID
  ChatType: 'direct' | 'group' | 'channel';
  MessageId: string;
  ReplyToId?: string;
  MediaUrl?: string;
  Timestamp?: string;
}

/** WebSocket handshake: client sends this first */
export interface ConnectParams {
  type: 'connect';
  agentId?: string;
  capabilities?: string[];
}

/** WebSocket handshake: server responds with this */
export interface HelloOk {
  type: 'hello';
  protocolVersion: number;
  agentId: string;
  channels: string[];      // available channels
}

/** Outbound reply sent back through Gateway */
export interface GatewayReply {
  type: 'reply';
  channel: string;
  to: string;
  body: string;
  replyToId?: string;
}

/** Gateway configuration */
export interface OpenClawGatewayConfig {
  url: string;              // "ws://127.0.0.1:18789"
  agentId?: string;
  reconnectIntervalMs: number;
  maxReconnectAttempts: number;
}

/** Any frame sent/received over the Gateway WebSocket */
export type GatewayFrame =
  | ConnectParams
  | HelloOk
  | { type: 'message'; payload: OpenClawMessage }
  | GatewayReply
  | { type: 'error'; code: string; message: string }
  | { type: 'ping' }
  | { type: 'pong' };
