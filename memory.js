const fs = require('fs');
const path = require('path');

const MEMORY_FILE = path.join(__dirname, 'chatMemory.json');

function loadChatMemory() {
    try {
        if (fs.existsSync(MEMORY_FILE)) {
            const data = fs.readFileSync(MEMORY_FILE, 'utf8');
            return JSON.parse(data);
        }
    } catch (err) {
        console.error('[AI_Paul] Error loading memory:', err);
    }
    return [];
}

function saveChatMemory(memory) {
    try {
        fs.writeFileSync(MEMORY_FILE, JSON.stringify(memory, null, 2));
    } catch (err) {
        console.error('[AI_Paul] Error saving memory:', err);
    }
}

module.exports = { loadChatMemory, saveChatMemory };