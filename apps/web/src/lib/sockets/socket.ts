import { io, type Socket } from "socket.io-client";

const SOCKET_URL = process.env.NEXT_PUBLIC_API_URL?.replace("/api", "") ?? "http://localhost:4000";
let socket: Socket | null = null;

export function getSocket() {
  if (!socket) {
    socket = io(`${SOCKET_URL}/socket`, {
      transports: ["websocket"],
      withCredentials: true
    });
  }

  return socket;
}
