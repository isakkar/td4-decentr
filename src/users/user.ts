import bodyParser from "body-parser";
import express from "express";
import { BASE_USER_PORT } from "../config";
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
    log("User received message:", req.body.message);
    const body = req.body; // Get the message
    lastReceivedMessage = body.message; // Update the variable
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
      console.log(`Selected nodes:`, selectedNodes.map(n => n.nodeId));

      // Encrypt message in layers (from last to first node)
      let encryptedMessage = message; // Start with the original message
      for (let i = 2; i >= 0; i--) {
        const node = selectedNodes[i];
        // Generate a symmetric key for this node
        const symmetricKey = await createRandomSymmetricKey();
        const symmetricKeyBase64 = await exportSymKey(symmetricKey);
        // Define the next node's destination
        const nextDestination =
            i === 2 ? destinationUserId : selectedNodes[i + 1].nodeId;
        const nextDestinationString = nextDestination.toString().padStart(10, "0");
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
      const entryNodeUrl = `http://localhost:${4000 + entryNode.nodeId}/message`;
      console.log(`Sending to node ${entryNode.nodeId}`);

      await fetch(entryNodeUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: encryptedMessage }),
      });

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
