import bodyParser from "body-parser";
import express, { Request, Response } from "express";
import { REGISTRY_PORT } from "../config";

export type Node = { nodeId: number; pubKey: string };

export type RegisterNodeBody = {
  nodeId: number;
  pubKey: string;
};

export type GetNodeRegistryBody = {
  nodes: Node[];
};

export async function launchRegistry() {
  const _registry = express();
  _registry.use(express.json());
  _registry.use(bodyParser.json());

  const nodes: Node[] = []; // Store registered nodes

  // Implement the status route
  _registry.get("/status", (req, res) => {
    res.send('live');
  });

  // Route to register nodes on the registry
  _registry.post("/registerNode", (req:Request, res:Response) => {
    const { nodeId, pubKey }: RegisterNodeBody = req.body; // Get the parameters
    nodes.push({ nodeId, pubKey }); // Register the node
    res.status(200).json({ success: true, message: "Node registered" });
  });

  // Route to retrieve all registered nodes
  _registry.get("/getNodeRegistry", (req:Request, res:Response) => {
    const payload: GetNodeRegistryBody = { nodes };
    res.json(payload);
  });

  const server = _registry.listen(REGISTRY_PORT, () => {
    console.log(`registry is listening on port ${REGISTRY_PORT}`);
  });

  return server;
}
