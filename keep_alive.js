// repl.it shuts down its repl.co servers when they go for an hour without any activity.
// To prevent this, a third-party service called Uptime Robot has been configured to
// ping this bot once every 5 minutes. When the bot receives a ping, it will post in
// the internal log, which counts as "active" to repl.it.

const express = require('express');
const server = express();
const config = require('./config.json');

server.all('/', (req, res) => {
  res.send(`I'm awake and ready to go!`);
});

function keepAlive() {
  server.listen(3000, () => {console.log(`Yawwwwn... oh! I'm awake!`)});
};

module.exports = keepAlive;