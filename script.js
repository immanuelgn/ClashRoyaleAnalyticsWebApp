let chartInstance = null;

document.getElementById("analyzeBtn").addEventListener("click", analyzeDeck);

async function analyzeDeck() {
  const input = document.getElementById("cardsInput").value;

  if (!input) {
    alert("Please enter card IDs.");
    return;
  }

  // Convert input string → array of numbers
  const cardIds = input
    .split(",")
    .map(id => parseInt(id.trim()))
    .filter(id => !isNaN(id));

  if (cardIds.length !== 8) {
    alert("Please enter exactly 8 valid card IDs.");
    return;
  }

  try {
    const response = await fetch("https://localhost:7295/api/deck/synergy", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ cardIds })
    });

    if (!response.ok) {
      throw new Error("API request failed");
    }

    const data = await response.json();

    // ✅ Update text
    document.getElementById("deckType").innerText =
      `Deck Type: ${data.deckType}`;

    document.getElementById("score").innerText =
      `Synergy Score: ${data.synergyScore}`;

    // ✅ Draw chart
    renderChart(data.breakdown);

  } catch (err) {
    console.error(err);
    alert("Error analyzing deck. Check console.");
  }
}

function renderChart(breakdown) {
  const labels = Object.keys(breakdown);
  const values = Object.values(breakdown);

  const ctx = document.getElementById("synergyChart").getContext("2d");

  // 🔥 Destroy old chart before drawing new one
  if (chartInstance) {
    chartInstance.destroy();
  }

  chartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Synergy Breakdown",
        data: values,
        backgroundColor: "#4dabf7"
      }]
    },
    options: {
      responsive: true,
      scales: {
        y: {
          beginAtZero: true,
          max: 100
        }
      }
    }
  });
}
