const { app, BrowserWindow } = require("electron");
const path = require("path");

function createWindow() {

const win = new BrowserWindow({
width: 700,
height: 600,
webPreferences: {
nodeIntegration: true,
contextIsolation: false
}
});

win.loadFile("src/renderer/index.html");

}

app.whenReady().then(createWindow);