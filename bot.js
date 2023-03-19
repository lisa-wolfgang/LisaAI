module.exports = function bot() {
  // Packages - extensions for JS used in this bot
  const fs = require('fs');
  const Discord = require('discord.js');
  const fetch = require('node-fetch');
  const Database = require("@replit/database");
  const { performance } = require('perf_hooks');

  // Constants - any value that won't change
  const keep_alive = require('./keep_alive.js');
  const config = require('./config.json');
  const updates = require('./updates.json');
  const latestUpdate = Object.getOwnPropertyNames(updates)[0];
  const client = new Discord.Client({
    intents: [
      Discord.Intents.FLAGS.GUILDS,
      Discord.Intents.FLAGS.GUILD_MESSAGES,
      Discord.Intents.FLAGS.DIRECT_MESSAGES,
    ],
    partials: ["CHANNEL"]
  });
  const token = process.env["DISCORD_BOT_SECRET"];
  const db = new Database();

  // Variables - any value that might change and placeholders for value storage
  var devMode;
  let promptTally = getPromptTally();
  let answerTally = getAnswerTally();
  var wtlChannels = [];
  var wtlMessages = [];
  var wtlAuthors = [];
  var lastMsgTime = [];
  var wtlContexts = [];

  String.prototype.replaceAll = function(arg1, arg2) {
    let result = this;
    while (result.replace(arg1, arg2) != result) {
      result = result.replace(arg1, arg2);
    }
    return result.toString();
  }

  // Developer actions -- set up in config.json
  devDashboard();

  // When bot is booted up, access Discord
  console.log("Accessing Discord...")
  client.login(token).catch(e => {
    console.log("Something went wrong while logging in:");
    throw new Error(e);
  });

  // When bot has successfully accessed Discord
  client.on('ready', () => {
    repairDatabase();
    console.log(`I'm ready to go! :)`);
    console.log(`Started uptime at ${Date()}`);
    console.log(`Using ${promptTally} prompts and ${answerTally} answers`);
    setStatus();
    checkUpdates();
    keep_alive();
  });

  // When message is sent
  client.on('messageCreate', message => {
    // Determine which channel context the bot should enter
    message.wtlIndex = wtlChannels.indexOf(message.channel.id);
    if (message.wtlIndex == -1) {
      message.wtlIndex = wtlChannels.length;
      wtlChannels.push(message.channel.id);
      wtlMessages.push([]);
      wtlContexts.push([]);
      wtlAuthors.push(0);
      lastMsgTime.push(0);
    }
    message.wtlMessage = wtlMessages[message.wtlIndex];
    message.wtlContext = wtlContexts[message.wtlIndex];
    message.wtlAuthor = wtlAuthors[message.wtlIndex];
    message.lastMsgTime = lastMsgTime[message.wtlIndex];

    let input = message.content.toLowerCase()
      .trim()
      .replace(',', '')
      .split(/ +/g); // Handles extra space between words

    // Don't respond to messages sent by the bot / in training mode /
    // in learning channels, when the bot last sent a message in
    // this channel less than a second ago, or when there is a mention
    // in the message not pinging this bot
    message.noRespond = false;
    if (message.author.id == client.user.id
      || config.trainingMode
      || config.learnOnlyChannels.includes(message.channel.id)
      || performance.now() - message.lastMsgTime < 1000
      || (message.mentions.users.size > 0 && !message.mentions.has(client.user))) {
      message.noRespond = true;
    }

    // Don't learn from the previous message when this message was
    // sent by a bot / the same author / a blacklisted user, when
    // the message is over 1000 characters / 5 lines, when the
    // context message is the same as this message, when this
    // message is the same as the previous message, or when this
    // message is in a NSFW channel/guild
    message.noLearn = false;
    if (message.author.bot
      || message.author.id == message.wtlAuthor
      || config.blacklistedUsers.includes(message.author.id)
      || message.content.length > 1000
      || message.content.split("\n").length > 10
      || areArraysEqual(message.wtlContext, input)
      || areArraysEqual(message.wtlMessage, input)
      || message.channel.nsfw
      || (message.guild && message.guild.available && (message.guild.nsfwLevel == "EXPLICIT" || message.guild.nsfwLevel == "AGE_RESTRICTED"))
    ) {
      message.noLearn = true;
    }

    // Ignore all messages that are not from the bot owner in devMode
    if (!devMode || config.botOwners.includes(message.author.id)) {
      // Remove non-@LisaAI mentions
      message.content = message.content.replace(new RegExp(`<@!?(?!${client.user.id})\\d+>`, 'g'), "");
      // Load all learning data
      let globalDict = fs.readFileSync('data.txt');
      if (globalDict && globalDict != '') { // does database have content?
        globalDict = JSON.parse(globalDict);
        let prompts = globalDict.map((i) => {
          return i.prompt;
        });

        recordLearning(message, globalDict);

        // Find the best-matching prompt for the input
        let bestMatch = -1;
        let bestMatchStrength = -1;
        let pIteration = 0;
        // Search every prompt
        prompts.forEach(function(prompt) {
          evaluatePrompt(prompt);
          pIteration += 1;
        });

        function evaluatePrompt(prompt) {
          let matches = 0;
          if (prompt[0].includes(" ")) {
            prompt = prompt[0].split(" ");
          }
          // Scan every word in the input and look for it in the prompt
          input.forEach(function(word) {
            if (prompt.includes(word.toLowerCase())) {
              matches += 1;
            }
          });
          if (matches / input.length > bestMatchStrength) {
            bestMatch = pIteration;
            bestMatchStrength = matches / input.length;
          } else if (bestMatchStrength == matches / input.length) {
            // If another prompt is found of the same match strength,
            // compare the match-per-word density in each prompt,
            // favoring the prompt with higher density
            let currentPromptStrength = matches / prompt.length;
            let bestPromptMatchCount = Math.round(bestMatchStrength * input.length)
            let bestPromptStrength = bestPromptMatchCount / prompts[bestMatch].length;
            if (currentPromptStrength > bestPromptStrength
              || (currentPromptStrength == bestPromptStrength && Math.floor(Math.random() * 2) == 1)) {
              bestMatch = pIteration;
            }
          }
        }

        // If a suitable prompt was found, respond to it
        if (bestMatchStrength >= config.similarityThreshold) {
          respond();
        } else {
          // If no suitable prompt was found, search the prompts again,
          // this time not being strict with capitalization/punctuation
          input = input.map((e) => filterPunctuation(e));
          pIteration = 0;
          prompts.forEach(function(prompt) {
            prompts[pIteration] = prompt.map((e) => filterPunctuation(e));
            pIteration += 1;
          });
          pIteration = 0;
          prompts.forEach(function(prompt) {
            evaluatePrompt(prompt);
            pIteration += 1;
          });

          function filterPunctuation(str) {
            let result = str;
            for (char of [".", ",", "?", "!", "/", "(", ")", "-", "_", "+", "=", "[", "]", "{", "}", "\\", "|", "\"", "'", "`", "~", "*", "#", ":", ";", "<", ">"])
              result = result.replaceAll(char, "");
            return result;
          }

          // If this time a suitable prompt was found, respond
          if (bestMatchStrength >= config.similarityThreshold) {
            respond();
          } else {
            // Otherwise just give up and do nothing
            if (config.printLearning) console.log("Message not sent.");
          }
        }

        function respond() {
          if (message.noRespond) {
            if (config.printLearning) console.log("Did not respond to this message.");
          } else {
            let response = globalDict[bestMatch].answers[Math.floor(Math.random() * globalDict[bestMatch].answers.length)];
            if (response != "") {
              // Replace @LisaAI mentions with mentioning the message author
              response = response.replaceAll(`<@!${client.user.id}>`, `<@!${message.author.id}>`);
              // Send the best match (disable @everyone, @here, and @roles)
              message.channel.send({
                content: response,
                allowedMentions: {
                  "parse": ["users"]
                }
              }).catch(e => {
                console.log("Could not send the response message in this channel.");
              });
              lastMsgTime[message.wtlIndex] = performance.now();
            } else {
              // Discord doesn't let us send blank messages, so we'll send a GIF!
              const params = {
                baseURL: "https://api.giphy.com/v1/gifs/",
                apiKey: "0UTRbFtkMxAplrohufYco5IY74U8hOes",
                tag: input.join(" "),
                type: "random",
                rating: "pg-13"
              };
              const requestURL = encodeURI(
                params.baseURL +
                params.type +
                "?api_key=" +
                params.apiKey +
                "&tag=" +
                params.tag +
                "&rating=" +
                params.rating
              );
              fetch(requestURL)
                .then(res => res.json())
                .then(json => {
                  message.channel.send({
                    files: [json.data.images.original.url]
                  }).catch(e => {
                    console.log("Could not send the image in this channel.");
                  });
                });
            }
          }
        }

        writeToLearn(message, input);
        if (config.printLearning) console.log("Context: " + wtlContexts[message.wtlIndex].join(" "));
        if (config.printLearning) console.log("Input: " + input.join(" "));
        if (config.printLearning) console.log("Best match: " + prompts[bestMatch].join(" "));
        if (config.printLearning) console.log("Best match strength: " + bestMatchStrength);
      } else {
        // If database does not yet have content
        if (config.printLearning) console.log("Database does not yet have content.")
        globalDict = [];
        recordLearning(message, globalDict);
        writeToLearn(message, input);
      }
      if (config.printLearning) console.log("---");
    }
  })

  // Saves this message as a prompt and sets the next message to record a new answer
  function writeToLearn(message, input) {
    wtlContexts[message.wtlIndex] = message.wtlMessage;
    wtlMessages[message.wtlIndex] = input;
    wtlAuthors[message.wtlIndex] = message.author.id;
  }

  // If a previous message was unidentified, add it to the database
  function recordLearning(message, globalDict) {
    try {
      if (message.noLearn) {
        if (config.printLearning) console.log("Did not learn from this message.")
        return;
      }
      if (message.wtlMessage.length == 0) {
        if (config.printLearning) console.log("No previous message to learn from.")
        return;
      }
      // Figure out if this prompt already has answer(s)
      let oldEntry = globalDict.findIndex(o => {
        return areArraysEqual(o.prompt, message.wtlMessage);
      });
      // If so, then add this new response to the existing answer list
      if (oldEntry != -1) {
        globalDict[oldEntry].answers.push(message.content);
        answerTally++;
        setStatus();
      } else {
        // If not, then make a new prompt entry
        message.wtlMessage = message.wtlMessage.map((e) => e.replace(/"/g, `\"`));
        let object = {
          prompt: [],
          answers: []
        }
        message.wtlMessage.forEach(e => {
          object.prompt.push(e);
        });
        object.answers.push(message.content);
        globalDict.push(object);
        promptTally++;
        answerTally++;
        setStatus();
      }
      fs.writeFileSync('data.txt', JSON.stringify(globalDict));
      if (config.printLearning) console.log(`Learned response for "${message.wtlMessage.join(" ")}"`)
      wtlMessages[message.wtlIndex] = [];
      wtlAuthors[message.wtlIndex] = 0;
    } catch (e) {
      console.log("A problem occurred while trying to learn this response: " + e);
    }
  }

  function areArraysEqual(one, two) {
    return one.length == two.length
      && one.every((e, i) => one[i] == two[i]);
  }

  // Sets the bot's playing/watching status
  function setStatus(status) {
    if (devMode) {
      client.user.setActivity('devmode', { type: 'PLAYING' });
    } else {
      if (status == null) {
        client.user.setActivity(`${answerTally} responses`, { type: 'PLAYING' });
      } else {
        client.user.setActivity(`${status}`, { type: 'PLAYING' });
      }
    }
  }

  async function checkUpdates() {
    let lastPosted = await db.get("lastPosted");
    if (lastPosted !== latestUpdate) {
      console.log("Posting the latest announcement...");
      client.guilds.cache.forEach(guild => {
        const channel = guild.channels.cache.find(c => {
          // Does the bot have permission to send messages here?
          return c.type == "GUILD_TEXT" && c.permissionsFor(client.user).has(['VIEW_CHANNEL', 'SEND_MESSAGES']);
        });
        if (channel) {
          const current = Object.entries(updates)[0];
          if (channel.permissionsFor(client.user).has('EMBED_LINKS')) {
            const embed = new Discord.MessageEmbed()
              .setColor(config.botColor)
              .addFields(
                {
                  name: `Announcement from the creator of LisaAI`,
                  value: current[1].note
                }
              );
            channel.send({ embeds: [embed] }).catch(e => {
              console.log("Could not send the embed in this channel.")
            });
          } else {
            channel.send("**Announcement from the creator of LisaAI**\n"
              + current[1].note).catch(e => {
                console.log("Could not send the message in this channel.")
              });
          }
        }
      });
      db.set("lastPosted", latestUpdate);
      console.log("The latest announcement has been posted in all servers.");
    }
  }

  function getPromptTally() {
    let result = 0;
    let globalDict = fs.readFileSync('data.txt');
    globalDict = JSON.parse(globalDict);
    if (globalDict && globalDict != '') {
      result = globalDict.length;
    }
    return result;
  }

  function getAnswerTally() {
    let result = 0;
    let globalDict = fs.readFileSync('data.txt');
    globalDict = JSON.parse(globalDict);
    if (globalDict && globalDict != '') {
      for (let promptObj of globalDict) {
        result += promptObj.answers.length
      }
    }
    return result;
  }

  function repairDatabase() {
    if (config.repairDatabase) {
      try {
        const newGlobalDict = [];
        let globalDict = fs.readFileSync('data.txt');
        if (globalDict && globalDict != '') {
          globalDict = JSON.parse(globalDict);
          globalDict.forEach((_, i) => {
            let e = globalDict[i];
            if (e.prompt[0].includes(" ")) {
              e.prompt = e.prompt[0].split(" ");
            }
            let newWords = [];
            e.prompt.forEach(word => {
              newWords.push(word.replace(new RegExp(`<@!?(?!${client.user.id})\\d+>`, 'g'), ""));
            });
            e.prompt = newWords;
            let newAnswers = [];
            e.answers.forEach(answer => {
              if (!(answer.length > 1000 || answer.split("\n").length > 10)) {
                newAnswers.push(answer.replace(new RegExp(`<@!?(?!${client.user.id})\\d+>`, 'g'), ""));
              }
            });
            e.answers = newAnswers;
            let newE, newI;
            if (newGlobalDict.some((_e, _i) => {
              if (areArraysEqual(_e.prompt, e.prompt)) {
                newE = _e;
                newI = _i;
                return true;
              }
            })) {
              // The prompt already exists, let's merge the answers
              let mergedAnswers = newE.answers.concat(e.answers);
              newE.answers = mergedAnswers;
              newGlobalDict[newI] = newE;
            } else {
              // The prompt doesn't exist yet, just push it
              newGlobalDict.push(e);
            }
          });
        }
        fs.writeFileSync('data.txt', JSON.stringify(newGlobalDict));
        console.log("Database successfully repaired.")
      } catch (e) {
        console.log("There was an error while repairing the database\n(the database was not modified):\n" + e);
      }
    }
  }

  function devDashboard() {
    // Keep shut off - set to true to prevent the repl from automatically running on its own
    if (config.shutOff) {
      throw 'The bot has been manually shut off.\nToggle this in config.json to re-enable it.';
    }

    // Toggle devMode - this allows whoever is set as the bot owner to test
    // potentially unstable features without the risk of others breaking something
    if (config.devMode) {
      devMode = true;
      console.log('Devmode has been enabled.\nIf this isn\'t intended, be sure to disable it in config.json\nand restart the bot.');
    } else {
      devMode = false;
    }

    // Reset the database file
    if (config.purgeDatabase) {
      if (prompt('Purge database? You can always recover from the revision history.\n(Type Y to confirm)').toLowerCase() == 'y') {
        fs.writeFileSync('data.txt', '');
        console.log('Purge complete.');
      } else {
        console.log('Purge cancelled.');
      }
    }
  }
}