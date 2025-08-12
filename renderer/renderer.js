const { ipcRenderer } = require("electron");

let isAutomationRunning = false;
let progressInterval = null;

//start btn handler
document.getElementById("startBtn").addEventListener("click", () => {
  const result = confirm("Mulai jalankan program?");
  if (result) {
    isAutomationRunning = true;
    ipcRenderer.send("update-automation-status", true);
    showProgressText();
    ipcRenderer.invoke("start-automation");
  }
});

//prosedure window handler
document.getElementById("openProsedur").addEventListener("click", () => {
  ipcRenderer.send("open-prosedur-window");
});

//program finished handler
ipcRenderer.on("automation-finished", () => {
  isAutomationRunning = false;
  ipcRenderer.send("update-automation-status", false);
  hideProgressText();
});

//add log func
function addLog(message, type) {
  const logDiv = document.getElementById("logs-tab");
  if (logDiv) {
    const logBubble = document.createElement("div");
    logBubble.classList.add("log-bubble");

    const time = new Date();
    const hours = String(time.getHours()).padStart(2, "0");
    const minutes = String(time.getMinutes()).padStart(2, "0");
    const timestamp = `${hours}.${minutes}`;

    logBubble.innerHTML = `
      <span class="log-message">${
        type !== "" ? `[${type.toUpperCase()}]<br>` : ""
      }${message}</span>
      <span class="log-time">${timestamp}</span>
    `;

    logDiv.insertBefore(logBubble, logDiv.firstChild);

    const logItems = logDiv.querySelectorAll(".log-bubble");
    if (logItems.length > 10) {
      logDiv.removeChild(logItems[logItems.length - 1]);
    }

    logDiv.scrollTop = 0;
  }
}

//counter data func
function updateDataCounter() {
  const tbody = document.querySelector(".data-table tbody");
  const count = tbody.querySelectorAll("tr").length;
  document.getElementById("data-count").textContent = `${count} data tersimpan`;
  const isDataExist = count > 0;
  ipcRenderer.send("update-data-status", isDataExist);
}

//log listener
ipcRenderer.on("log", (event, { message, type }) => {
  addLog(message, type);
});
window.addEventListener("DOMContentLoaded", () => {
  addLog("Sistem siap untuk digunakan", "info");
  addLog("Klik tombol GO untuk memulai", "info");
});

//data listener
ipcRenderer.on("data", (event, data) => {
  const table = document.querySelector("#data-tab tbody");
  if (table) {
    const rowHTML = `
      <tr>
        <td>${data.inet}</td>
        <td>${data.ticket}</td>
        <td>${data.sto}</td>
        <td>${data.odp}</td>
        <td>${data.flag_hvc}</td>
      </tr>
    `;
    table.insertAdjacentHTML("beforeend", rowHTML);
    updateDataCounter();
  }
});

//export handle
document.getElementById("exportBtn").addEventListener("click", () => {
  const table = document.querySelector(".data-table");
  if (!table) return;
  let csv = [];

  const headers = [...table.querySelectorAll("thead th")].map((th) =>
    th.textContent.trim()
  );
  csv.push(headers.join(","));

  const rows = table.querySelectorAll("tbody tr");
  if (rows.length <= 0) {
    alert("Tidak ada data untuk diekspor.");
    return;
  }

  rows.forEach((row) => {
    const cols = [...row.querySelectorAll("td")].map((td) =>
      td.textContent.trim()
    );
    csv.push(cols.join(","));
  });

  const csvContent = csv.join("\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });

  const url = URL.createObjectURL(blob);
  const downloadLink = document.createElement("a");

  const now = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const yyyy = now.getFullYear();
  const mm = pad(now.getMonth() + 1);
  const dd = pad(now.getDate());
  const hh = pad(now.getHours());
  const min = pad(now.getMinutes());
  const ss = pad(now.getSeconds());
  const filename = `ticket_unspec_${yyyy}${mm}${dd}_${hh}${min}${ss}.csv`;

  downloadLink.href = url;
  downloadLink.setAttribute("download", filename);
  downloadLink.click();

  URL.revokeObjectURL(url);
});

//'on progress' text handler
function showProgressText() {
  const progressText = document.getElementById("progressText");
  const btnWrapper = document.getElementById("btnWrapper");

  if (progressText && btnWrapper) {
    btnWrapper.style.display = "none";
    progressText.style.display = "block";
    progressText.innerHTML = "On<br>Progress";
  }
}
function hideProgressText() {
  const progressText = document.getElementById("progressText");
  const btnWrapper = document.getElementById("btnWrapper");

  if (progressText && btnWrapper) {
    progressText.style.display = "none";
    btnWrapper.style.display = "block";
    progressText.innerHTML = "";
  }
}
