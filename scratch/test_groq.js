const Groq = require('groq-sdk');
require('dotenv').config();

const apiKey = process.env.GROQ_API_KEY;
if (!apiKey) {
  console.error("No GROQ_API_KEY env variable found!");
  process.exit(1);
}

const groq = new Groq({ apiKey });

async function run() {
  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'];
  for (const model of models) {
    try {
      console.log(`Testing model: ${model}...`);
      const response = await groq.chat.completions.create({
        messages: [{ role: 'user', content: 'Say hello in 3 words.' }],
        model,
      });
      console.log(`Success: ${response.choices[0]?.message?.content}\n`);
    } catch (err) {
      console.error(`Error for ${model}:`, err.message, '\n');
    }
  }
}

run();
