import { WebSocketServer, WebSocket } from 'ws';
import dotenv from 'dotenv';
import { createClient } from '@supabase/supabase-js';

dotenv.config();
// Quick sanity check: decode the JWT payload
if (process.env.SUPABASE_KEY) {
    const payload = JSON.parse(Buffer.from(process.env.SUPABASE_KEY.split('.')[1], 'base64').toString());
    console.log('Active Supabase Role:', payload.role); 
}
const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_KEY
);

const wss = new WebSocketServer({ port: Number(process.env.PORT) || 8080 });

wss.on('connection', async (socket, request) => {
    const ip = request.socket.remoteAddress;

    // Load history
    const { data: history, error: historyErr } = await supabase
        .from('messages')
        .select('id, sender_name, content, created_at')
        .order('created_at', { ascending: false })
        .limit(50);

    if (historyErr) {
        console.error(`Error fetching history for ${ip}:`, historyErr.message);
    } else {
        socket.send(JSON.stringify({
            type: 'history',
            data: history.reverse()
        }));
    }

    // Handle incoming WS messages
    socket.on('message', async (rawData) => {
        try {
            let sender = 'anonymous';
            let content = rawData.toString();

            try {
                const parsedData = JSON.parse(content);
                if (parsedData.content) {
                    sender = parsedData.sender || parsedData.sender_name || 'anonymous';
                    content = parsedData.content;
                }
            } catch (_) {}

            if (!content.trim()) return;

            // Save to DB
            const { data: newMessage, error: insertErr } = await supabase
                .from('messages')
                .insert([{ sender_name: sender, content }])
                .select()
                .single();

            if (insertErr) {
                console.error(`Insert error for ${ip}:`, insertErr.message);
                return;
            }

            // Broadcast to connected WS clients
            wss.clients.forEach((client) => {
                if (client.readyState === WebSocket.OPEN) {
                    client.send(JSON.stringify({
                        type: 'new_message',
                        data: newMessage
                    }));
                }
            });

        } catch (error) {
            console.error(`Error processing message from ${ip}:`, error);
        }
    });

    socket.on('error', (err) => console.error(`WS error with ${ip}:`, err.message));
});

console.log(`WebSocket server running on ws://localhost:${process.env.PORT || 8080}`);