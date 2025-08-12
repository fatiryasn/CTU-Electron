const { app, BrowserWindow, ipcMain, dialog } = require("electron");
const path = require("path");
const runAutomation = require("./scraper/ctuScript");

let mainWindow;
let isAutomationRunning = false;
let isDataExist = false;

//main window load
function createWindow() {
  mainWindow = new BrowserWindow({
    width: 610,
    height: 550,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    resizable: false,
  });

  mainWindow.loadFile(path.join(__dirname, "renderer", "index.html"));

  mainWindow.on("close", (e) => {
    if (isAutomationRunning || isDataExist) {
      const choice = dialog.showMessageBoxSync(mainWindow, {
        type: "warning",
        buttons: ["Batal", "Keluar"],
        defaultId: 0,
        title: "Konfirmasi",
        message:
          "Keluar dari aplikasi akan menghentikan automatisasi dan menghapus semua data. Tetap ingin keluar?",
      });

      if (choice === 0) {
        e.preventDefault();
      }
    }
  });
}
app.whenReady().then(createWindow);

//procedure window listener
ipcMain.on("open-prosedur-window", () => {
  const prosedurWindow = new BrowserWindow({
    width: 500,
    height: 450,
    title: "Prosedur Pemakaian",
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false,
    },
    autoHideMenuBar: true,
    resizable: false,
  });

  prosedurWindow.loadFile(path.join(__dirname, "renderer", "prosedure.html"));
});

//start program listener
ipcMain.handle("start-automation", async (event) => {
  runAutomation(
    (logObj) => {
      event.sender.send("log", logObj);
    },
    (dataObj) => {
      event.sender.send("data", dataObj);
    },
    () => {
      event.sender.send("automation-finished")
    }
  );
});

//data n status listener
ipcMain.on("update-automation-status", (event, status) => {
  isAutomationRunning = status;
});
ipcMain.on("update-data-status", (event, status) => {
  isDataExist = status;
});
