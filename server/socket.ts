import { Server as SocketIOServer } from 'socket.io';

let ioInstance: SocketIOServer | null = null;

export function setSocketIO(io: SocketIOServer) {
  ioInstance = io;
}

export function getSocketIO(): SocketIOServer | null {
  return ioInstance;
}

export function broadcastEvent(event: string, data: any) {
  if (ioInstance) {
    ioInstance.emit(event, data);
  }
}
