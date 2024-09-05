const express = require("express");
const http = require("http");
const socketIo = require("socket.io");
const chokidar = require("chokidar");
const path = require("path");
const fs = require("fs");
const readline = require("readline");

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// Serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, "public")));

const PORT = process.env.PORT || process.argv[3] || 3000;
server.listen(PORT, () => {
    LogUtils.debug(`Server is running on port ${PORT}`);
});

const logFilePath = process.argv[2];

// Watch for changes in the log file
const watcher = chokidar.watch(logFilePath, {
    persistent: true,
    usePolling: true, // Use polling to detect changes
    interval: 100, // Check for changes with millis
});

watcher.on("change", monitorFileChanges);

let isWatching = true;

io.on("connection", (socket) => {
    LogUtils.debug("io connection ::: connected");
    socket.emit("logFilePath", logFilePath);

    if (isWatching) {
        isWatching = false;
        monitorFileChanges();
    }

    socket.on("disconnect", () => {
        LogUtils.debug("io connection ::: disconnected");
    });
});

let lastFileSize = 0;
let currentFileSize = 0;

// Function to monitor file changes
function monitorFileChanges() {
    fs.stat(logFilePath, (err, stats) => {
        if (err) {
            LogUtils.debug(`Error getting file stats: ${err.message}`);
            return;
        }

        currentFileSize = stats.size;

        if (currentFileSize > lastFileSize) {
            if (lastFileSize === 0) {
                lastFileSize = currentFileSize;
                io.emit("logUpdate", "logFilePath : " + logFilePath);
            }
            LogUtils.debug(
                `monitorFileChanges ::: lastFileSize : ${lastFileSize} , currentFileSize: ${currentFileSize}`
            );

            let newData = "";

            const readStream = fs.createReadStream(logFilePath, {
                start: lastFileSize,
                end: currentFileSize,
            });
            readStream.on("data", (chunk) => {
                newData += chunk;
            });

            readStream.on("end", () => {
                if (newData) {
                    sendLogUpdate(newData);

                    lastFileSize = currentFileSize;

                    LogUtils.debug(`monitorFileChanges ::: New data appended`);
                }
            });
        }
    });
}

// Function to send log updates to clients
function sendLogUpdate(logData) {
    LogUtils.debug("sendLogUpdate ::: io emit logUpdate");
    io.emit("logUpdate", logData);
}

class LogUtils {
    static isDebugEnabled = true;

    static debug(...args) {
        if (LogUtils.isDebugEnabled) {
            let list = [];
            args.forEach((arg) => {
                list.push(arg);
            });

            const timestamp = new Date()
                .toISOString()
                .replace("T", " ")
                .substring(0, 19);

            const stack = new Error().stack.split("\n");
            let caller = "";

            if (stack[2]) {
                const trimmedCaller = stack[2]
                    .trim()
                    .replace("(", "")
                    .replace(")", "");
                const lastBackslashIndex = trimmedCaller.lastIndexOf("\\");
                caller =
                    lastBackslashIndex !== -1
                        ? trimmedCaller.substring(lastBackslashIndex + 1)
                        : trimmedCaller;
            }

            console.log(`[${timestamp}] [DEBUG] [${caller}]`, ...list, "\n");
        }
    }
    static trace(...args) {
        if (LogUtils.isDebugEnabled) {
            let list = [];
            args.forEach((arg) => {
                list.push(arg);
            });

            const timestamp = new Date()
                .toISOString()
                .replace("T", " ")
                .substring(0, 19);

            const stack = new Error().stack.split("\n");
            if (stack[3]) {
                const trimmedCaller = stack[3]
                    .trim()
                    .replace("(", "")
                    .replace(")", "");
                const lastBackslashIndex = trimmedCaller.lastIndexOf("\\");
                caller =
                    lastBackslashIndex !== -1
                        ? trimmedCaller.substring(lastBackslashIndex + 1)
                        : trimmedCaller;
            }

            console.log(`[${timestamp}] [TRACE] [${caller}]`, "\n");
        }
    }
}
