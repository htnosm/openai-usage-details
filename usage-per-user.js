let apiKey;
let organizationId;

const buttonLabels = [
  { type: "day", value: 1 },
  { type: "day", value: 3 },
  { type: "day", value: 7 },
  { type: "month", value: 1 },
  { type: "month", value: 2 },
  { type: "month", value: 3 },
];

function createButtons() {
  const buttonsDiv = document.getElementById("buttons");

  buttonLabels.forEach((buttonData) => {
    const button = document.createElement("button");
    const label = formatButtonLabel(buttonData);
    button.textContent = label;
    button.id = label;
    button.onclick = () => fetchData(buttonData.type, buttonData.value);
    buttonsDiv.appendChild(button);
  });
}

createButtons();

/*
function defaultFetchData() {
  document.getElementById("Today").click();
}
document.addEventListener("DOMContentLoaded", defaultFetchData);
*/

function formatButtonLabel(buttonData) {
  if (buttonData.type === "month") {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const targetMonth = currentMonth - (buttonData.value - 1);
    const targetYear = currentYear + Math.floor(targetMonth / 12);
    const month = targetMonth % 12;
    return `${targetYear}/${String(month + 1).padStart(2, "0")}`;
  } else if (buttonData.type === "day" && buttonData.value == 1) {
    return `Today`;
  } else {
    return `Last ${buttonData.value} days`;
  }
}

function fetchData(type, value) {
  const dateList = [];
  if (type === "day") {
    const today = new Date();
    for (let i = value - 1; i >= 0; i--) {
      const date = new Date(
        today.getFullYear(),
        today.getMonth(),
        today.getDate() - i
      );
      dateList.push(formatDate(date));
    }
  } else if (type === "month") {
    const currentMonth = new Date().getMonth();
    const currentYear = new Date().getFullYear();
    const targetMonth = currentMonth - (value - 1);
    const targetYear = currentYear + Math.floor(targetMonth / 12);
    const month = targetMonth % 12;

    const daysInMonth = new Date(targetYear, month + 1, 0).getDate();
    for (let i = 1; i <= daysInMonth; i++) {
      const date = new Date(targetYear, month, i);
      dateList.push(formatDate(date));
    }
  }

  apiKey = document.getElementById("apiKey").value;
  organizationId = document.getElementById("organizationId").value;
  if (!apiKey || !organizationId) {
    alert("Please enter both Organization ID and API Key.");
    return;
  }

  console.log(`Fetching data for ${type} ${value}:`, dateList);
  usagePerUser(dateList);
}

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

async function fetchUsers() {
  let url =
    "https://api.openai.com/v1/organizations/" + organizationId + "/users";

  try {
    const response = await fetch(url, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
      },
    });
    let data = await response.json();

    if (response.status !== 200) {
      alert(`Error: ${response.status} - ${data.error.message}`);
      return;
    }

    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

async function fetchUsageByUser(dateStr, userId) {
  let url =
    "https://api.openai.com/v1/usage?date=" +
    dateStr +
    "&user_public_id=" +
    userId;

  try {
    const response = await fetch(url, {
      method: "get",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "openai-organization": organizationId,
      },
    });
    let data = await response.json();

    if (response.status !== 200) {
      alert(`Error: ${response.status} - ${data.error.message}`);
      return;
    }

    return data;
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

async function usagePerUser(dateList) {
  let users = await fetchUsers();
  //console.log("fetchUsers:" + JSON.stringify(users, null, 2));
  let result = {};
  dateList.forEach((date) => {
    result[date] = [];
  });

  if (
    users.members &&
    Array.isArray(users.members.data) &&
    users.members.data.length > 0
  ) {
    for (const member of users.members.data) {
      let user = member.user;

      for (const dateStr of dateList) {
        let usageData = await fetchUsageByUser(dateStr, user.id);
        //console.log("fetchUsageByUser:" + JSON.stringify(usageData, null, 2));
        if (
          usageData.data.length > 0 ||
          usageData.ft_data.length > 0 ||
          usageData.dalle_api_data.length > 0 ||
          usageData.whisper_api_data.length > 0 ||
          usageData.current_usage_usd > 0
        ) {
          result[dateStr].push({
            user_id: user.id,
            user_name: user.name,
            data: usageData,
          });
        }
      }
    }
  } else {
    console.log("members.data is empty or not present");
  }

  //console.log(JSON.stringify(result, null, 2));
  const summaryData = createSummaryData(dateList, result);
  //console.log(JSON.stringify(summaryData, null, 2));
  if (Object.keys(summaryData).length === 0) {
    alert("Usage is empty.");
    return;
  }
  createRequestsPerUserChart(summaryData);
  createTokensPerUserChart(summaryData);
  createAverageTokensPerRequestChart(summaryData);
  createWhisperTotalRequestsChart(summaryData);
  createWhisperTotalSecondsChart(summaryData);
  createWhisperAverageSecondsChart(summaryData);
}

function createSummaryData(dateList, data) {
  const groupedData = {};

  for (const date in data) {
    data[date].forEach((user) => {
      if (!groupedData[user.user_name]) {
        groupedData[user.user_name] = {};
      }

      const n_requests = user.data.data.reduce(
        (sum, item) => sum + item["n_requests"],
        0
      );
      const total_tokens = user.data.data.reduce(
        (sum, item) =>
          sum +
          item["n_context_tokens_total"] +
          item["n_generated_tokens_total"],
        0
      );

      const whisper_requests = user.data.whisper_api_data.reduce(
        (sum, item) => sum + item["num_requests"],
        0
      );
      const whisper_secounds = user.data.whisper_api_data.reduce(
        (sum, item) => sum + item["num_seconds"],
        0
      );

      groupedData[user.user_name][date] = {
        n_requests: n_requests,
        total_tokens: total_tokens,
        average_tokens: n_requests > 0 ? total_tokens / n_requests : 0,
        whisper_total_requests: whisper_requests,
        whisper_total_secounds: whisper_secounds,
        whisper_average_secounds:
          whisper_requests > 0 ? whisper_secounds / whisper_requests : 0,
      };
    });
  }

  // Sort each user's data in date order.
  for (const userName in groupedData) {
    dateList.forEach((date) => {
      if (!groupedData[userName][date]) {
        groupedData[userName][date] = {};
      }
    });
    groupedData[userName] = Object.keys(groupedData[userName])
      .sort()
      .reduce((sortedData, date) => {
        sortedData[date] = groupedData[userName][date];
        return sortedData;
      }, {});
  }

  return groupedData;
}

function createDataSetFromSummaryData(summaryData, keyName, labelFunction) {
  const datasets = [];

  for (const userName in summaryData) {
    const color = labelFunction(userName);
    const userData = Object.entries(summaryData[userName]).map(
      ([date, value]) => ({
        x: date,
        y: value[keyName],
      })
    );
    datasets.push({
      label: userName,
      data: userData,
      borderColor: color,
      backgroundColor: `${color}B3`, // 70% transparency
    });
  }

  return datasets;
}

const requestsPerUserCtx = document
  .getElementById("requestsPerUserChart")
  .getContext("2d");
let requestsPerUserChart;

function createDataSetFromSummaryData(summaryData, keyName, labelFunction) {
  const datasets = [];

  for (const userName in summaryData) {
    const color = labelFunction(userName);
    const userData = Object.entries(summaryData[userName]).map(
      ([date, value]) => ({
        x: date,
        y: value[keyName],
      })
    );
    datasets.push({
      label: userName,
      data: userData,
      borderColor: color,
      backgroundColor: `${color}B3`, // 70% transparency
    });
  }

  return datasets;
}

function createRequestsPerUserChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "n_requests",
    getColorForLabel
  );

  if (requestsPerUserChart) {
    requestsPerUserChart.destroy();
  }

  requestsPerUserChart = new Chart(requestsPerUserCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Requests per user",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const tokensPerUserCtx = document
  .getElementById("tokensPerUserChart")
  .getContext("2d");
let tokensPerUserChart;

function createTokensPerUserChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "total_tokens",
    getColorForLabel
  );

  if (tokensPerUserChart) {
    tokensPerUserChart.destroy();
  }

  tokensPerUserChart = new Chart(tokensPerUserCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Total tokens per user",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const averageTokensPerRequestCtx = document
  .getElementById("averageTokensPerRequestChart")
  .getContext("2d");
let averageTokensPerRequestChart;

function createAverageTokensPerRequestChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "average_tokens",
    getColorForLabel
  );

  if (averageTokensPerRequestChart) {
    averageTokensPerRequestChart.destroy();
  }

  averageTokensPerRequestChart = new Chart(averageTokensPerRequestCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Average tokens per request",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const whisperTotalRequestsCtx = document
  .getElementById("whisperTotalRequestsChart")
  .getContext("2d");
let whisperTotalRequestsChart;

function createWhisperTotalRequestsChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "whisper_total_requests",
    getColorForLabel
  );

  if (whisperTotalRequestsChart) {
    whisperTotalRequestsChart.destroy();
  }

  whisperTotalRequestsChart = new Chart(whisperTotalRequestsCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Whisper API: Total requests per user",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const whisperTotalSecondsCtx = document
  .getElementById("whisperTotalSecondsChart")
  .getContext("2d");
let whisperTotalSecondsChart;

function createWhisperTotalSecondsChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "whisper_total_secounds",
    getColorForLabel
  );

  if (whisperTotalSecondsChart) {
    whisperTotalSecondsChart.destroy();
  }

  whisperTotalSecondsChart = new Chart(whisperTotalSecondsCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Whisper API: Total seconds per user",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const whisperAverageSecondsCtx = document
  .getElementById("whisperAverageSecondsChart")
  .getContext("2d");
let whisperAverageSecondsChart;

function createWhisperAverageSecondsChart(summaryData) {
  const datasets = createDataSetFromSummaryData(
    summaryData,
    "whisper_average_secounds",
    getColorForLabel
  );

  if (whisperAverageSecondsChart) {
    whisperAverageSecondsChart.destroy();
  }

  whisperAverageSecondsChart = new Chart(whisperAverageSecondsCtx, {
    type: "bar",
    data: {
      labels: Object.keys(summaryData[Object.keys(summaryData)[0]]),
      datasets,
    },
    options: {
      plugins: {
        title: {
          display: true,
          text: "Whisper API: Average seconds per request",
        },
      },
      scales: {
        y: {
          beginAtZero: true,
        },
      },
    },
  });
}

const fixedColors = [
  "#FF6384", // Red
  "#36A2EB", // Blue
  "#FFCE56", // Yellow
  "#4BC0C0", // Cyan
  "#9966FF", // Purple
  "#FF9F40", // Orange
  "#E6E6E6", // Grey
  "#A2E8A2", // Light Green
  "#FFA6A6", // Light Red
  "#B3D1FF", // Light Blue
];
const labelColors = {};

function getColorForLabel(label) {
  if (!labelColors[label]) {
    const colorIndex = Object.keys(labelColors).length % fixedColors.length;
    labelColors[label] = fixedColors[colorIndex];
  }
  return labelColors[label];
}
