const fs = require('fs');
const path = require('path');

const src = path.join(__dirname, '../app/octo-client/dist');
const dest = path.join(__dirname, '../approuter/resources');

function copyDir(src, dest) {
    fs.mkdirSync(dest, { recursive: true });
    let entries = fs.readdirSync(src, { withFileTypes: true });

    for (let entry of entries) {
        let srcPath = path.join(src, entry.name);
        let destPath = path.join(dest, entry.name);

        entry.isDirectory() ? copyDir(srcPath, destPath) : fs.copyFileSync(srcPath, destPath);
    }
}

// Clean destination
if (fs.existsSync(dest)) {
    fs.rmSync(dest, { recursive: true, force: true });
}

console.log(`Copying React build from ${src} to ${dest}...`);
if (fs.existsSync(src)) {
    copyDir(src, dest);
    console.log('Copy complete!');
} else {
    console.error(`Source directory not found: ${src}. Did you run build:client?`);
    process.exit(1);
}
