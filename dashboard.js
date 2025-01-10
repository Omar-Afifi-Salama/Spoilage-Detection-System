const timeElement = document.getElementById('current-time');

function updateTime() {
    const currentDate = new Date();
    let hours = currentDate.getHours();
    const minutes = currentDate.getMinutes().toString().padStart(2, '0');
    const seconds = currentDate.getSeconds().toString().padStart(2, '0');
    const period = hours >= 12 ? 'PM' : 'AM';
    hours = hours % 12 || 12;
    const formattedTime = `${hours.toString().padStart(2, '0')} : ${minutes} : ${seconds} ${period}`;
    timeElement.textContent = formattedTime;
}

setInterval(updateTime, 1000);
updateTime();

const APP_ID = '43587D63-E5C5-4966-844B-E75C72804CCC';
const API_KEY = '7F3F9B1E-2DA2-467E-80DA-D5126E9EE8C8';
const TABLE_NAME = 'SensorData';

const safeRanges = {
    Temperature: { min: 0, max: 25, unit: '°C' },
    Humidity: { min: 0, max: 50, unit: '%' },
    CO2: { min: 0, max: 500, unit: 'ppm' },
    CH4: { min: 0, max: 50, unit: 'ppm' },
    NH3: { min: 0, max: 12.5, unit: 'ppm' },
    Propane: { min: 0, max: 10, unit: 'ppm' },
    Toluene: { min: 0, max: 2.5, unit: 'ppm' },
    Alcohol: { min: 0, max: 10, unit: 'ppm' },
};

async function fetchLatestData() {
    try {
        const response = await fetch(
            `https://api.backendless.com/${APP_ID}/${API_KEY}/data/${TABLE_NAME}?pageSize=1&sortBy=created desc`
        );
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        return data.length > 0 ? data[0] : null;
    } catch (error) {
        console.error('Error fetching latest data:', error);
        return null;
    }
}


    // Fetch all data (for CSV and charts)
    async function fetchAllData() {
      const pageSize = 100;
      let offset = 0;
      let allData = [];
      let dataChunk;

      try {
        do {
          const response = await fetch(
            `https://api.backendless.com/${APP_ID}/${API_KEY}/data/${TABLE_NAME}?pageSize=${pageSize}&offset=${offset}`
          );
          dataChunk = await response.json();
          allData = allData.concat(dataChunk);
          offset += pageSize;
        } while (dataChunk.length === pageSize);

        // Sort data by timestamp (assuming "created" is the timestamp field)
        allData.sort((a, b) => new Date(a.created) - new Date(b.created));

        return allData;
      } catch (error) {
        console.error('Error fetching data:', error);
        return [];
      }
    }

    // Convert JSON to CSV
    function jsonToCsv(data) {
      if (!data || data.length === 0) return '';

      const headers = Object.keys(data[0]);
      const rows = data.map(row =>
        headers.map(header => `"${row[header] || ''}"`).join(',')
      );
      return [headers.join(','), ...rows].join('\n');
    }

    // Trigger CSV download
    function downloadCsv(csvContent, filename = 'data.csv') {
      const blob = new Blob([csvContent], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    // Create a chart
    function createChart(canvasId, label, data, labels, color) {
        let slicedLabels = labels;
        let slicedData = data;
    
        if (window.innerWidth <= 768) { // Check if it's a mobile screen
            slicedLabels = labels.slice(-20); // Show last 20 points on mobile
            slicedData = data.slice(-20);
        } else {
            slicedLabels = labels.slice(-100); // Show last 100 points on desktop
            slicedData = data.slice(-100);
        }

      new Chart(document.getElementById(canvasId), {
        type: 'line',
        data: {
          labels: slicedLabels,
          datasets: [
            {
              label: label,
              data: slicedData,
              borderColor: color,
              fill: false,
            },
          ],
        },
        options: {
            maintainAspectRatio: false,
          responsive: true,
          scales: {
            x: { title: { display: true, text: 'Time (HH:mm:ss)' } },
            y: { title: { display: true, text: label } },
          },
        },
      });
    }

    // Check if the value is within the safe range
    function checkSafety(value, range) {
      return value >= range.min && value <= range.max ? 'Normal' : 'Dangerous';
    }

    // Create a dashboard with the latest data
    function createDashboard(latestData) {
      const parameterContainer = document.getElementById('parameters');
      parameterContainer.innerHTML = ''; // Clear existing content

      Object.entries(safeRanges).forEach(([key, range]) => {
        const value = latestData[key];

        // Skip creating a parameter block if value is missing
        if (value === undefined || value === null) return;

        const status = checkSafety(value, range);

        const block = document.createElement('div');
        block.className = 'parameter-block';
        block.innerHTML = `
          <h2>${key}</h2>
          <div class="value">${value} ${range.unit}</div>
          <div class="status ${status.toLowerCase()}">${status}</div>
        `;
        parameterContainer.appendChild(block);
      });
    }

    // Initialize the dashboard and charts
    async function initialize() {
      const allData = await fetchAllData();

      // Hide loading indicator
      document.getElementById('loading').style.display = 'none';

      // Map sorted data to labels and chart data
      const labels = allData.map(item => new Date(item.created).toLocaleTimeString());
      const chartsContainer = document.getElementById('charts-container');
      chartsContainer.innerHTML = ''; // Clear existing content

      const colors = [
        'rgba(255, 99, 132, 1)', // Red
        'rgba(54, 162, 235, 1)', // Blue
        'rgba(75, 192, 192, 1)', // Green
        'rgba(255, 206, 86, 1)', // Yellow
        'rgba(153, 102, 255, 1)', // Purple
        'rgba(255, 159, 64, 1)', // Orange
        'rgba(201, 203, 207, 1)', // Gray
        'rgba(100, 149, 237, 1)', // Cornflower Blue
      ];

      Object.entries(safeRanges).forEach(([key, range], index) => {
        const chartData = allData.map(item => item[key]).filter(value => value !== undefined);

        // Skip creating a chart if no data exists for this key
        if (chartData.length === 0) return;

        const canvasId = `${key}-chart`;
        const chartBlock = document.createElement('div');
        chartBlock.className = 'chart-block';
        chartBlock.innerHTML = `<canvas id="${canvasId}" height="800"></canvas>`; // Set height here
        chartsContainer.appendChild(chartBlock);

        const color = colors[index % colors.length]; // Cycle through colors
        createChart(canvasId, `${key} (${range.unit})`, chartData, labels, color);
      });

      if (allData.length > 0) {
        // Show the latest data in the dashboard
        createDashboard(allData[allData.length - 1]);

        // Enable CSV download
        const csvContent = jsonToCsv(allData);
        const downloadButton = document.getElementById('download-btn');
        downloadButton.disabled = false;
        downloadButton.addEventListener('click', () => downloadCsv(csvContent));
      }
    }


    // Initialize the app
    initialize();

    function checkSafety(value, range) {
        return value >= range.min && value <= range.max ? 'Normal' : 'Dangerous';
    }
    
    async function requestNotificationPermission() {
        if (!("Notification" in window)) {
            console.log("This browser does not support notifications.");
            return false;
        }
    
        if (Notification.permission === "granted") {
            return true;
        } else if (Notification.permission !== "denied") {
            try {
                const permission = await Notification.requestPermission();
                return permission === "granted";
            } catch (error) {
                console.error("Error requesting notification permission:", error);
                return false;
            }
        }
    
        return false;
    }
    
    function showNotification(title, body) {
        if (Notification.permission === "granted") {
            try {
                const notification = new Notification(title, { body });
                notification.onclick = function() {
                    window.focus();
                    this.close();
                };
            } catch (error) {
                console.error("Error showing notification:", error);
            }
        }
    }
    
    function checkSafetyAndNotify(value, range, parameterName) {
        const status = checkSafety(value, range);
        if (status === 'Dangerous') {
            requestNotificationPermission().then(granted => {
                if (granted) {
                    showNotification("Spoilage Alert!", `${parameterName} is out of safe range: ${value} ${range.unit}`);
                } else {
                    console.log("Notification permission denied.");
                }
            });
        }
        return status;
    }
    
    function createDashboard(latestData) {
        const parameterContainer = document.getElementById('parameters');
        parameterContainer.innerHTML = '';
    
        if (!latestData) {
            parameterContainer.innerHTML = "<p>No data available.</p>";
            return;
        }
    
        Object.entries(safeRanges).forEach(([key, range]) => {
            const value = latestData[key];
    
            if (value === undefined || value === null) return;
    
            const status = checkSafetyAndNotify(value, range, key);
    
            const block = document.createElement('div');
            block.className = 'parameter-block';
            block.innerHTML = `
                <h2>${key}</h2>
                <div class="value">${value} ${range.unit}</div>
                <div class="status ${status.toLowerCase()}">${status}</div>
            `;
            parameterContainer.appendChild(block);
        });
    }

    document.addEventListener('DOMContentLoaded', initialize);

    function toggleMenu() {
        const navRight = document.getElementById('navRight');
        navRight.classList.toggle('active');
    }
