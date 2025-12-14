const fs = require('fs');

let db = { users: {}, blocked: [] };
const dbFile = './database.json';

function load() {
    try {
        if (fs.existsSync(dbFile)) {
            db = JSON.parse(fs.readFileSync(dbFile, 'utf8'));
        }
    } catch { save(); }
}

function save() {
    fs.writeFileSync(dbFile, JSON.stringify(db, null, 2));
}

function addUser(id, data = {}) {
    if (!db.users[id]) {
        db.users[id] = { id, ...data, joinDate: Date.now() };
        save();
    }
}

load();

module.exports = { addUser, save, db };
