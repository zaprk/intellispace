import { ChatOllama } from "@langchain/ollama";

const llm = new ChatOllama({
    model: "llama3.1:8b",
    baseUrl: "http://localhost:11434",
});

const aiMsg = await llm.invoke([
    [
      "system",
      "You are a helpful assistant that translates English to russian. Translate the user sentence.",
    ],
    ["human", "I love programming."],
  ]);
  aiMsg;

  console.log(aiMsg.content);