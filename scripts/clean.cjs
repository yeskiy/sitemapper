const fs = require("fs");
const path = require("path");
const distPath = path.join(__dirname, "../lib");
if (fs.existsSync(distPath)) {
    fs.rmSync(distPath, {recursive: true});
}