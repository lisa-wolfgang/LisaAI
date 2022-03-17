const bot = require("./bot.js");
const config = require("./config.json");

let recentError = false;

run();

function run() {
  try {
    bot();
  } catch(e) {
    if (!recentError) {
      console.log(e);
      recentError = true;
      setTimeout(() => {
        if (recentError) {
          recentError = false;
          console.log("Resuming execution...");
          console.log();
        }
      }, 1000);
      run();
    } else {
      recentError = false;
      console.log("Please fix this error in order to use the bot again.");
    }
  }
}