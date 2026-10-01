import { WebSocketServer, WebSocket } from 'ws';

const wss = new WebSocketServer({ port: 8080});

wss.on('connection', (socket, request) => {
    const ip = request.socket.remoteAddress;

    socket.on('message', (rawData) => {
        console.log(`Received message from ${ip}: ${rawData}`);
        const message=rawData.toString();
        wss.clients.forEach((client) => {
            if (client.readyState === WebSocket.OPEN) {
                client.send(`Server Broadcast: ${rawData}`);
            }
        });
    });

    socket.on('error', (error) => {
        console.error(`Error on connection with ${ip}:`, error.message);
    });

    socket.on('close', (code, reason) => {
        console.log(`Connection with ${ip} closed. Code: ${code}, Reason: ${reason}`);
    });
});

console.log('WebSocket server is running on ws://localhost:8080');