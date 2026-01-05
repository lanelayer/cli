import express, { Request, Response } from "express";

const app = express();
const PORT = parseInt(process.env.PORT || "3000", 10);

// In-memory K/V store (ephemeral - resets on restart)
const store = new Map<string, Buffer>();

// Parse raw binary bodies
app.use(express.raw({ type: "*/*", limit: "10mb" }));

// Health check
app.get("/health", (_req: Request, res: Response) => {
	res.json({ status: "ok", keys: store.size });
});

// GET /kv/:key - Read value
app.get("/kv/*", (req: Request, res: Response) => {
	const key = req.params[0];

	if (!key) {
		res.status(400).send("Key required");
		return;
	}

	const value = store.get(key);

	if (value === undefined) {
		res.status(404).send("Not found");
		return;
	}

	res.set("Content-Type", "application/octet-stream");
	res.send(value);
});

// POST /kv/:key - Set value
app.post("/kv/*", (req: Request, res: Response) => {
	const key = req.params[0];

	if (!key) {
		res.status(400).send("Key required");
		return;
	}

	const body = req.body as Buffer;
	store.set(key, body);

	console.log(`[KV] SET ${key} (${body.length} bytes)`);
	res.status(200).send("OK");
});

// DELETE /kv/:key - Delete value
app.delete("/kv/*", (req: Request, res: Response) => {
	const key = req.params[0];

	if (!key) {
		res.status(400).send("Key required");
		return;
	}

	if (!store.has(key)) {
		res.status(404).send("Not found");
		return;
	}

	store.delete(key);
	console.log(`[KV] DELETE ${key}`);
	res.status(200).send("OK");
});

app.listen(PORT, "0.0.0.0", () => {
	console.log(`[KV] Service listening on port ${PORT}`);
	console.log(`[KV] Ephemeral mode - data will be lost on restart`);
});
