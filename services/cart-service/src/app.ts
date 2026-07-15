import express from "express";

export const app = express();

app.get("/healthz", (_req, res) => {
  res.json({ status: "ok" });
});
