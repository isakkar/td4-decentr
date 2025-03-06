import bodyParser from "body-parser";
import express from "express";
import {BASE_ONION_ROUTER_PORT, BASE_USER_PORT} from "../config";
import {RegisterNodeBody} from "@/src/registry/registry";
import {createRandomSymmetricKey, exportSymKey, symEncrypt, rsaEncrypt} from "../crypto";
import { log, error } from "console";

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
  let lastCircuit: number[] = [-1, -1, -1];

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

  // Route to get the last circuit the user used
  _user.get("/getLastCircuit", (req, res) => {
    res.json({ result: lastCircuit });
  })

  // Route to receive messages
  _user.post("/message", (req, res) => {
    const message = req.body.message; // Get the message
    lastReceivedMessage = message; // Update the variable
    res.send("success");
  });

  // Route to send messages
  _user.post("/sendMessage", async (req, res) => {
    try {
      const { message, destinationUserId }: SendMessageBody = req.body;

      // Fetch available nodes from registry
      const response = await fetch("http://localhost:8080/getNodeRegistry");
      const { nodes }: { nodes: RegisterNodeBody[] } = (await response.json()) as { nodes: RegisterNodeBody[] };

      if (nodes.length < 3) {
        res.status(500).json({ error: "Not enough nodes available" });
        return;
      }

      // Select 3 random distinct nodes
      const selectedNodes = nodes
          .sort(() => Math.random() - 0.5) // Shuffle nodes
          .slice(0, 3); // Take the first 3

      // Encrypt message in layers (from last to first node)
      let encryptedMessage = message;

      for (let i = 2; i >= 0; i--) {
        const node = selectedNodes[i];
        lastCircuit[i] = node.nodeId; // store in circuit variable

        // Generate a symmetric key for this node
        const symmetricKey = await createRandomSymmetricKey();
        const symmetricKeyBase64 = await exportSymKey(symmetricKey);

        // Define the next node's destination
        const basePort = i === 2 ? BASE_USER_PORT : BASE_ONION_ROUTER_PORT; // if last node, its next destination is a user
        const nextDestination = i === 2 ? destinationUserId : selectedNodes[i+1].nodeId;
        const nextDestinationPort = basePort + nextDestination;
        const nextDestinationString = nextDestinationPort.toString().padStart(10, "0");

        // Concatenate destination and encrypted message, then encrypt it
        const concatenatedMessage = nextDestinationString + encryptedMessage;
        const encryptedLayer = await symEncrypt(symmetricKey, concatenatedMessage);

        // Encrypt the symmetric key with the node's RSA public key
        const encryptedSymmetricKey = await rsaEncrypt(symmetricKeyBase64, node.pubKey);

        // Concatenate the encrypted symmetric key + encrypted message
        encryptedMessage = encryptedSymmetricKey + encryptedLayer;
      }

      // Send the final encrypted message to the entry node's /message route
      const entryNode = selectedNodes[0];
      const entryNodeUrl = `http://localhost:${BASE_ONION_ROUTER_PORT + entryNode.nodeId}/message`;

      await fetch(entryNodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: encryptedMessage }),
      });

      lastSentMessage = message; // update variable
      res.send("success");

    } catch (err) {
      console.error("Error in /sendMessage:", err);
      res.status(500).json({ error: "Failed to send message" });
    }
  });

  const server = _user.listen(BASE_USER_PORT + userId, () => {
    console.log(
      `User ${userId} is listening on port ${BASE_USER_PORT + userId}`
    );
  });

  return server;
}
