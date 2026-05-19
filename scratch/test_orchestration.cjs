async function test() {
  console.log("Sending patriotic orchestration request to http://localhost:3001/api/muse/generate...");
  try {
    const response = await fetch('http://localhost:3001/api/muse/generate', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        prompt: "a patriotic anthem celebrating the beauty of our country and its freedom",
        genre: "orchestral anthem",
        emotion: "proud",
        mood: "majestic"
      })
    });
    const data = await response.json();
    if (response.ok) {
      console.log("\nSuccess! Song details generated:\n");
      console.log(JSON.stringify(data, null, 2));
    } else {
      console.error("API returned error status:", response.status, data);
    }
  } catch (err) {
    console.error("Error calling API:", err.message);
  }
}

test();
