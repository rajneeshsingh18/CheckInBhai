import { io, Socket } from "socket.io-client";
import Cookies from "js-cookie";

const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || "http://localhost:3000";

let socket: Socket | null = null;

export const getSocket = (): Socket => {
  if (!socket) {
    const token = Cookies.get("accessToken");
    socket = io(SOCKET_URL, {
      autoConnect: false,
      auth: {
        token,
      },
      withCredentials: true,
    });
  }
  return socket;
};

export const connectSocket = () => {
  const s = getSocket();
  const token = Cookies.get("accessToken");
  
  // Update token in case it refreshed
  s.auth = { token };
  
  if (!s.connected) {
    s.connect();
    console.log("[Socket.io] Connecting client...");
  }
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    console.log("[Socket.io] Disconnected client.");
    socket = null;
  }
};
