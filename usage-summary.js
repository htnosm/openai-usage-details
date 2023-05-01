let apiKey;
let organizationId;

const currentDate = new Date();
const currentYear = currentDate.getFullYear();
const currentMonth = currentDate.getMonth() + 1;
const dateList = [
  formatDate(new Date(currentYear, currentMonth - 1)),
  formatDate(new Date(currentYear, currentMonth - 2)),
  formatDate(new Date(currentYear, currentMonth - 3)),
];

function formatDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  return `${year}-${month}`;
}

function createButtons() {
  const buttonsDiv = document.getElementById("buttons");

  dateList.forEach((date, index) => {
    const button = document.createElement("button");
    const dateStr = `${date.replace("-", "/")}`
    button.textContent = dateStr;
    button.id = date;
    button.onclick = () => fetchData(index);
    buttonsDiv.appendChild(button);
  });
}

createButtons();

/*
function defaultFetchData() {
  document.getElementById(dateList[0]).click();
}
document.addEventListener("DOMContentLoaded", defaultFetchData);
*/

const ctx = document.getElementById("stackedBarChart").getContext("2d");
let barChart;

async function fetchData(monthIndex) {
  const selectedMonth = dateList[monthIndex];
  const startDate = `${selectedMonth}-01`;
  const nextMonth = new Date(selectedMonth);
  nextMonth.setMonth(nextMonth.getMonth() + 1);
  const endDate = `${nextMonth.getFullYear()}-${String(
    nextMonth.getMonth() + 1
  ).padStart(2, "0")}-01`;

  const url = `https://api.openai.com/dashboard/billing/usage?end_date=${endDate}&start_date=${startDate}`;
  apiKey = document.getElementById("apiKey").value;
  organizationId = document.getElementById("organizationId").value;

  if (!apiKey || !organizationId) {
    alert("Please enter both Organization ID and API Key.");
    return;
  }

  try {
    const response = await fetch(url, {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: "Bearer " + apiKey,
        "openai-organization": organizationId,
      },
    });
    const data = await response.json();

    if (response.status !== 200) {
      alert(`Error: ${response.status} - ${data.error.message}`);
      return;
    }

    createChart(data, selectedMonth);
  } catch (error) {
    console.error("Error fetching data:", error);
  }
}

function createChart(data, selectedMonth) {
  const labels = data.daily_costs.map((item) =>
    new Date(item.timestamp * 1000).toLocaleDateString()
  );
  const datasets = {};

  data.daily_costs.forEach((day) => {
    day.line_items.forEach((item) => {
      if (!datasets[item.name]) {
        datasets[item.name] = {
          label: item.name,
          data: [],
          backgroundColor: getColorForLabel(item.name),
        };
      }
      datasets[item.name].data.push(item.cost);
    });
  });

  const chartData = {
    labels: labels,
    datasets: Object.values(datasets),
  };

  const config = {
    type: "bar",
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: "Daily usage (USD)",
        },
        legend: {
          position: "right",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          ticks: {
            callback: function (value) {
              return `$${(value / 100).toFixed(2)}`;
            },
          },
        },
      },
    },
  };

  if (barChart) {
    barChart.destroy();
  }

  barChart = new Chart(ctx, config);

  // 円グラフ用のデータを作成
  const pieChartData = data.daily_costs.reduce((acc, day) => {
    day.line_items.forEach((item) => {
      if (!acc[item.name]) {
        acc[item.name] = 0;
      }
      acc[item.name] += item.cost;
    });
    return acc;
  }, {});

  // 円グラフを作成
  createPieChart(pieChartData);
  createCumulativeAreaChart(data);
  updateUsageThisMonthText(pieChartData, selectedMonth);
}

function updateUsageThisMonthText(pieChartData, selectedMonth) {
  const totalUsage = Object.values(pieChartData).reduce((acc, curr) => acc + curr, 0);
  const formattedTotalUsage = (totalUsage / 100).toFixed(2);
  document.getElementById("usageThisMonth").innerHTML = `
    Usage for ${selectedMonth.replace("-", "/")}:</br>
    <span style="font-size: 24px; background-color: yellow; padding: 2px;">$${formattedTotalUsage}</span>
  `;
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

const pieCtx = document.getElementById("pieChart").getContext("2d");
let pieChart;

function createPieChart(data) {
  const labels = Object.keys(data);
  const values = Object.values(data);
  const backgroundColors = labels.map((label) => getColorForLabel(label));
  const total = values.reduce((acc, curr) => acc + curr, 0);

  const pieChartData = {
    labels: labels,
    datasets: [
      {
        data: values,
        backgroundColor: backgroundColors,
      },
    ],
  };

  const config = {
    type: "pie",
    data: pieChartData,
    plugins: [ChartDataLabels],
    options: {
      responsive: true,
      plugins: {
        title: {
          display: true,
          text: "Percentage of monthly usage by model",
        },
        legend: {
          position: "right",
        },
        tooltip: {
          callbacks: {
            label: function (tooltipItem, data) {
              if (tooltipItem && data) {
                const label = data.labels[tooltipItem.dataIndex];
                const value = data.datasets[0].data[tooltipItem.dataIndex];
                const percentage = ((value / total) * 100).toFixed(2);
                return `${label}: ${percentage}%`;
              }
            },
          },
        },
        datalabels: {
          color: "#000",
          anchor: "end",
          align: "end",
          offset: 5,
          formatter: function (value) {
            if (value === 0) {
              return null;
            }        
            const percentage = ((value / total) * 100).toFixed(2);
            return `${percentage}%`;
          },
        },
      },
    },
  };

  if (pieChart) {
    pieChart.destroy();
  }

  pieChart = new Chart(pieCtx, config);
}

const cumulativeAreaCtx = document
  .getElementById("cumulativeAreaChart")
  .getContext("2d");
let cumulativeAreaChart;

function createCumulativeAreaChart(data) {
  const labels = data.daily_costs.map((item) =>
    new Date(item.timestamp * 1000).toLocaleDateString()
  );
  const datasets = {};

  data.daily_costs.forEach((day) => {
    day.line_items.forEach((item) => {
      if (!datasets[item.name]) {
        datasets[item.name] = {
          label: item.name,
          data: [],
          backgroundColor: getColorForLabel(item.name),
          fill: "origin",
        };
      }
      const prevValue = datasets[item.name].data.slice(-1).pop() || 0;
      datasets[item.name].data.push(prevValue + item.cost);
    });
  });

  const chartData = {
    labels: labels,
    datasets: Object.values(datasets),
  };

  //console.log(Object.values(chartData));

  const config = {
    type: "line",
    data: chartData,
    options: {
      plugins: {
        title: {
          display: true,
          text: "Cumulative daily usage (USD)",
        },
        legend: {
          position: "right",
        },
      },
      scales: {
        x: {
          stacked: true,
        },
        y: {
          stacked: true,
          ticks: {
            callback: function (value) {
              return `$${(value / 100).toFixed(2)}`;
            },
          },
        },
      },
      elements: {
        line: {
          tension: 0, // Disable Bezier curves to make lines straight
        },
        point: {
          radius: 0, // Hide point markers
        },
      },
    },
  };

  if (cumulativeAreaChart) {
    cumulativeAreaChart.destroy();
  }

  cumulativeAreaChart = new Chart(cumulativeAreaCtx, config);
}
