const dotenv = require('dotenv');
dotenv.config();

const apiKey = process.env.LOUDLY_API_KEY;
if (!apiKey) {
  console.error("No LOUDLY_API_KEY configured!");
  process.exit(1);
}

async function test() {
  const BASE_URL = 'https://soundtracks.loudly.com';
  console.log("Testing Loudly API with prompt generation...");

  const form = new FormData();
  form.append('prompt', 'A grand patriotic orchestral anthem celebrating freedom');
  form.append('duration', '30');
  form.append('model', 'VEGA_2');

  try {
    const res = await fetch(`${BASE_URL}/api/ai/prompt/songs`, {
      method: 'POST',
      headers: { 
        'API-KEY': apiKey
      },
      body: form,
    });

    console.log("Status:", res.status);
    const text = await res.text();
    console.log("Response:", text);
  } catch (err) {
    console.error("Fetch error:", err.message);
  }
}

test();
