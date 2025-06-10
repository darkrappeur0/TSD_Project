import { Socket as SocketIOSocket } from 'socket.io';

declare module 'socket.io' {
  interface Socket {
    user?: {
      _id: string;
      username: string;
      email: string;
      password: string;
      createdAt: Date;
    };
  }
}

export interface AuthenticatedSocket extends SocketIOSocket {
  user: {
    _id: string;
    username: string;
    email: string;
    password: string;
    createdAt: Date;
  };
}