import { WebSocketServer } from "ws";
import express from "express";
import dotenv from "dotenv";
import cors from "cors";
import { createServer } from "node:http";
import signupRouter from "./api/signup.js";
import loginRouter from "./api/login.js";
import { setupWebSocketServer } from "./sockets/wsHandler.js";
import profileRouter from "./api/profile.js";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.use("/api/signup", signupRouter);
app.use("/api/login", loginRouter);
app.use("/api/profile", profileRouter);

const server = createServer(app);
const wss = new WebSocketServer({ server });

setupWebSocketServer(wss);

const PORT = process.env.PORT || 8080;

server.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});