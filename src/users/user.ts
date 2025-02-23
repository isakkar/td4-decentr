import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT } from "../config";
import {RegisterNodeBody} from "@/src/registry/registry";

export type SendMessageBody = {
  message: string;
  destinationUserId: number;
};

export async function user(userId: number) {
  const _user = express();
  _user.use(express.json());
  _user.use(bodyParser.json());

  let lastReceivedMessage: any = null;
  let lastSentMessage: any = null;

  // Implement the status route
  _user.get("/status", (req, res) => {
    res.send('live');
  });

  // Route to get the last received encrypted message
  _user.get("/getLastReceivedMessage", (req, res) => {
    res.json({ result: lastReceivedMessage });
  });

  // Route to get the last received decrypted message
  _user.get("/getLastSentMessage", (req, res) => {
    res.json({ result: lastSentMessage });
  });

  // Route to receive messages
  _user.post("/message", (req, res) => {
    const body = req.body; // Get the message
    lastReceivedMessage = body.message; // Update the variable
    res.send("success");
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}
