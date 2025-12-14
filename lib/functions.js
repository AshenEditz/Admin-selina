const moment = require("moment-timezone");

function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

function formatTime() {
    return moment.tz("Asia/Colombo").format("HH:mm:ss DD/MM/YYYY");
}

function getUptime(startTime) {
    const uptime = Date.now() - startTime;
    const s = Math.floor((uptime / 1000) % 60);
    const m = Math.floor((uptime / 60000) % 60);
    const h = Math.floor((uptime / 3600000) % 24);
    const d = Math.floor(uptime / 86400000);
    
    let str = '';
    if (d > 0) str += `${d}d `;
    if (h > 0) str += `${h}h `;
    if (m > 0) str += `${m}m `;
    str += `${s}s`;
    return str.trim();
}

function formatBytes(bytes) {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}

module.exports = { sleep, formatTime, getUptime, formatBytes };
