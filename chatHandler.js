const fs = require('fs');
const path = require('path');
const { saveChatMemory, loadChatMemory } = require('./memory');
const { GoalFollow, GoalBlock, GoalNear } = require('mineflayer-pathfinder').goals;
const vm = require('vm');
require('dotenv').config();

// === НАСТРОЙКИ CLOUDFLARE WORKERS AI ===
const CLOUDFLARE_API_KEY = 'cfut_f3kiYuPBS0R6qKPHVFwKWQrSVx3lYqU1dsUnOKrSe8592c61';
const CLOUDFLARE_ACCOUNT_ID = '7e107a1e8529f99e88aaa97e9105e5ac';
const CLOUDFLARE_MODEL = '@cf/meta/llama-3.1-8b-instruct';
const API_URL = `https://api.cloudflare.com/client/v4/accounts/${CLOUDFLARE_ACCOUNT_ID}/ai/run/${CLOUDFLARE_MODEL}`;

const GENERATED_FUNCS_DIR = path.join(__dirname, 'generatedFuncs');
const PLAYER_USERNAME = 'denkondakovv';

function executeGeneratedCode(code, bot, mcData) {
    const sandbox = {
        bot,
        mcData,
        console: console,
        setTimeout,
        require,
        GoalBlock, GoalNear, GoalFollow
    };
    const context = vm.createContext(sandbox);
    try {
        const wrappedCode = `(async () => { ${code} })()`;
        const script = new vm.Script(wrappedCode);
        script.runInContext(context);
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

async function generateCode(userMessage) {
    console.log(`[AI] Генерация кода для: "${userMessage}"`);
    const systemPrompt = `Ты — эксперт по Mineflayer API. Твоя задача — написать JavaScript-код, который выполнит запрос игрока.
У тебя есть доступ к объекту 'bot' (Mineflayer) и 'mcData' (данные о версии игры).
Доступные основные методы:
- bot.chat(message) — отправить сообщение в чат
- bot.pathfinder.setGoal(goal) — идти к цели. Используй GoalBlock(x,y,z), GoalNear(x,y,z,range), GoalFollow(entity, range)
- bot.placeBlock(referenceBlock, faceVector) — поставить блок
- bot.dig(block) — сломать блок
- bot.collectBlock.collect(block) — добыть блок и подобрать ресурсы
- bot.pvp.attack(entity) — атаковать сущность
- bot.nearestEntity(match) — найти ближайшую сущность
- bot.findBlocks(options) — найти блоки
- bot.inventory.items() — получить предметы в инвентаре

Пиши короткий, безопасный код, который делает ровно то, что просит игрок. Не используй бесконечные циклы. Если запрос невыполним, просто напиши bot.chat('Извини, я не могу это сделать.').
Верни ТОЛЬКО JavaScript-код, без объяснений и без обрамления в \`\`\`.`;

    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [
                { role: 'system', content: systemPrompt },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.2,
            max_tokens: 500
        })
    });

    if (!response.ok) {
        throw new Error(`Cloudflare API error ${response.status}`);
    }

    const data = await response.json();
    const code = data.result.response.trim();
    console.log('[AI] Сгенерированный код:\n', code);
    return code;
}

async function chatResponse(userMessage) {
    const response = await fetch(API_URL, {
        method: 'POST',
        headers: {
            'Authorization': `Bearer ${CLOUDFLARE_API_KEY}`,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({
            messages: [
                {
                    role: 'system',
                    content: `Ты — реальный друг игрока, твой ник denkondakovv. Ты общаешься как живой человек, с юмором, иногда используешь сленг и шутишь. Ты помогаешь игроку в Minecraft. Отвечай кратко и по-русски.`
                },
                { role: 'user', content: userMessage }
            ],
            temperature: 0.9,
            max_tokens: 150
        })
    });
    const data = await response.json();
    return data.result.response.trim();
}

module.exports = function (bot, mcData) {
    let following = false;
    let followTarget = null;
    const chatMemory = loadChatMemory();
    const dynamicFunctions = {};

    // Загрузка плагинов (исправлено)
    try {
        const pvp = require('mineflayer-pvp');
        const armorManager = require('mineflayer-armor-manager');
        const collectBlock = require('mineflayer-collectblock');
        
        bot.loadPlugin(pvp.plugin);
        bot.loadPlugin(armorManager.plugin);
        bot.loadPlugin(collectBlock.plugin);
        
        console.log('[AI_Paul] Плагины PvP, ArmorManager и CollectBlock загружены.');
    } catch (err) {
        console.error('[AI_Paul] Ошибка загрузки плагинов!', err);
    }

    function loadDynamicFunctions() {
        if (!fs.existsSync(GENERATED_FUNCS_DIR)) {
            fs.mkdirSync(GENERATED_FUNCS_DIR, { recursive: true });
        }
        const files = fs.readdirSync(GENERATED_FUNCS_DIR).filter(f => f.endsWith('.js'));
        for (const file of files) {
            try {
                const fullPath = path.join(GENERATED_FUNCS_DIR, file);
                delete require.cache[require.resolve(fullPath)];
                const funcModule = require(fullPath);
                const funcName = path.basename(file, '.js');
                if (typeof funcModule === 'function') {
                    dynamicFunctions[funcName] = funcModule;
                }
            } catch (err) {}
        }
    }
    loadDynamicFunctions();

    bot.on('physicsTick', () => {
        if (following && followTarget) {
            const target = bot.players[followTarget];
            if (target && target.entity) {
                const goal = new GoalFollow(target.entity, 2);
                bot.pathfinder.setGoal(goal, true);
            }
        }
    });

    bot.on('chat', async (username, message) => {
        if (username === bot.username) return;
        if (username.toLowerCase() !== PLAYER_USERNAME.toLowerCase()) return;

        const logLine = `${username}: ${message}`;
        chatMemory.push(logLine);
        if (chatMemory.length > 64) chatMemory.shift();

        const lowerMsg = message.toLowerCase();
        if (lowerMsg === 'иди за мной' || lowerMsg === 'следуй') {
            following = true;
            followTarget = username;
            bot.chat('👍 Иду за тобой!');
            return;
        }
        if (lowerMsg === 'стой' || lowerMsg === 'стоп') {
            following = false;
            followTarget = null;
            bot.pathfinder.setGoal(null);
            bot.chat('🛑 Остановился.');
            return;
        }

        try {
            const code = await generateCode(message);
            if (code.startsWith('bot.chat(')) {
                const chatMatch = code.match(/bot\.chat\(['"`](.+?)['"`]\)/);
                if (chatMatch) {
                    bot.chat(chatMatch[1]);
                } else {
                    const result = executeGeneratedCode(code, bot, mcData);
                    if (!result.success) {
                        bot.chat(`❌ Ошибка в коде: ${result.error}`);
                    }
                }
            } else {
                const result = executeGeneratedCode(code, bot, mcData);
                if (!result.success) {
                    bot.chat(`❌ Ошибка выполнения: ${result.error}`);
                }
            }
        } catch (err) {
            console.error('[AI_Paul] Ошибка генерации кода:', err);
            try {
                const response = await chatResponse(message);
                const trimmedResponse = response.slice(0, 100);
                chatMemory.push(`AI_Paul: ${trimmedResponse}`);
                saveChatMemory(chatMemory);
                bot.chat(trimmedResponse);
            } catch (e) {
                bot.chat('⚠️ Что-то пошло не так...');
            }
        }
    });

    return { following };
};