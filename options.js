const botOptions = {
  host: 'denkondakovv228.aternos.me',
  port: 61559,
  username: 'MarkKiller228',
  version: '1.20.1',          // явно указываем версию, без автоопределения
  auth: 'offline'
};

console.log('=== Настройки подключения ===');
console.log('HOST:', botOptions.host);
console.log('PORT:', botOptions.port);
console.log('USERNAME:', botOptions.username);
console.log('VERSION:', botOptions.version);
console.log('AUTH:', botOptions.auth);
console.log('=============================');

module.exports = { botOptions };