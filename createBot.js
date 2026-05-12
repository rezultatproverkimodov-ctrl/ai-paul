const mineflayer = require('mineflayer');
const { pathfinder } = require('mineflayer-pathfinder');
const { forgeHandshake } = require('minecraft-protocol-forge');
const chatHandler = require('./chatHandler');
const options = require('./options');

function createBot() {
  const bot = mineflayer.createBot({
    ...options.botOptions,
    version: '1.20.1'
  });
  
  bot.loadPlugin(pathfinder);

  // Плагины (правильный способ)
  try {
    bot.loadPlugin(require('mineflayer-pvp').plugin);
    bot.loadPlugin(require('mineflayer-armor-manager').plugin);
    bot.loadPlugin(require('mineflayer-collectblock').plugin);
    console.log('[AI_Paul] Плагины загружены.');
  } catch (err) {
    console.error('[AI_Paul] Ошибка загрузки плагинов:', err.message);
  }

  bot.on('connect', () => {
    console.log('[AI_Paul] Отправляю Forge handshake с базовыми модами...');
    forgeHandshake(bot._client, {
      forgeMods: [
        { modid: 'minecraft', version: '1.20.1' },
        { modid: 'forge', version: '47.2.1' },
        { modid: 'fml', version: '47.2.1' }  // иногда требуется
      ]
    });
  });

  bot.on('login', () => console.log('[AI_Paul] Залогинился!'));
  bot.on('error', err => console.log('[AI_Paul] Ошибка бота:', err));
  bot.on('kicked', reason => console.log('[AI_Paul] Кикнут. Причина:', reason));
  bot.on('end', reason => {
    console.log('[AI_Paul] Отключён. Причина:', reason || 'неизвестна');
    console.log('[AI_Paul] Переподключение через 10 секунд...');
    setTimeout(() => createBot(), 10000);
  });

  bot.once('spawn', () => {
    const mcData = require('minecraft-data')(bot.version);
    chatHandler(bot, mcData);
  });

  return bot;
}

module.exports = createBot;