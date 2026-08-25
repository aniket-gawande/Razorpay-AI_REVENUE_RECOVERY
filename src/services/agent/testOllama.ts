import "dotenv/config";
import { ChatOllama } from "@langchain/ollama";

const model = new ChatOllama({
  baseUrl: process.env.OLLAMA_BASE_URL || "http://localhost:11434",
  model: process.env.OLLAMA_MODEL || "gpt-oss:20b",
  temperature: 0,
});

async function main() {
  console.log("Testing model...");

  const response = await model.invoke(
    'Analyze this customer message: "The price is too high, can you give me 40% off?"'
  );

  console.log("MODEL RESPONSE:");
  console.dir(response.content, { depth: null });
}

main().catch((error) => {
  console.error("OLLAMA TEST FAILED:");
  console.error(error);
  process.exit(1);
});