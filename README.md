# LisaAI Documentation
LisaAI is a conversational chatbot by @lisa_wolfgang that features a simple form of machine learning. It uses PeanutKit to integrate with Discord as a bot user.

## To configure
Open `config.json`.

### Developer settings
- `shutOff` prevents the bot from starting. It's a nice extra safeguard if you're making a large or sensitive change.
- `devMode` only allows users listed as bot owners (`botOwners`) to access the bot, which is useful for testing.

### Learning settings
- (WIP) `trainingMode` disables chatting and enables training commands, which are useful for data entry. It's recommended to enable this alongside `devMode` to avoid your data being raided.
- `similarityThreshold` controls how similar a message must be to a recognized prompt in order to trigger a response for it. Accepts any decimal from `0` to `1`, with `0` requiring no similarity and `1` requiring full similarity. Setting this too low can cause highly repetitive responses while setting this too high can produce oddly specific responses.
- (WIP) `sharpness` controls how many times the bot needs to see a pattern before learning it. Accepts any integer greater than 0. Setting this too low can cause surprising and hilarious results while setting this too high will make the bot very slow to learn.
- `purgeDatabase` makes the bot forget everything it has ever learned on startup. Note that previous versions can be recovered from the repl's revision history.

### Roadmap (unfinished items in approximate order)
- ✅ Fix `similarityThreshold`
- ✅ Disable pings
- ✅ Add ability to learn multiple answers for one prompt
- ✅ Add ability to learn from responses to its own messages
- ✅ Don't learn if prompt and response are from same author
- ✅ Multi-channel support
- ✅ User blacklist
- ✅ Migrate to Discord.js v13 (thread support)
- ✅ Announcement system
- ✅ Don't learn messages over 1000 chars or longer than 10 lines
- ✅ Ratelimit
- ✅ Don't learn if spam is detected
- ✅ Don't learn if the prompt is an echo
- ✅ Don't respond to messages pinging other people
- ✅ Do not record mentions that aren't for @LisaAI
- ✅ Replace @LisaAI mentions with pinging the message author
- ✅ Remove existing non-@LisaAI mentions from database
- ✅ Don't learn from NSFW channels/guilds
- ✅ Create GitHub repo
- Word blacklist
- Handle Discord's reply feature
- Slash command for muting the bot in a channel
- Slash command for reporting messages
- Join message
- Opt-in to message collection
- Only allow training in community servers
- Replace "lisa", "lsia", "lisai", "lisaai", and variants with message author username
- Don't learn after five minutes pass
- Scan message history for learning
- Learn from public-domain books, Wikipedia, etc.
- Store context with each answer for smarter responses (and rickroll)
- Typo detection
- Replace duplicate answers with proper weight system
- Per-server database
- Slash command to disable profanity
- DM all members in server on join and policy updates (and DM new members)
- Fallback-scan without spaces
- Conversation starters
- `sharpness`
- Move database to Replit Database
- Store data using a tree model (group sentences that start with a given word)