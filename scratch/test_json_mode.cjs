const Groq = require('groq-sdk');
require('dotenv').config();

const apiKey = process.env.GROQ_API_KEY;
const groq = new Groq({ apiKey });

async function run() {
  const model = 'llama-3.3-70b-versatile';
  try {
    console.log(`Testing model ${model} with JSON mode...`);
    const response = await groq.chat.completions.create({
      messages: [
        { role: 'user', content: 'Output a JSON object with a key "message" containing a hello message. Do not output anything else than JSON.' }
      ],
      model,
      response_format: { type: 'json_object' },
    });
    console.log("Success:", response.choices[0]?.message?.content);
  } catch (err) {
    console.error("Error:", err.message);
  }
}

run();
