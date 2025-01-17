import * as env from "dotenv";
import * as cron from "node-cron";
import * as logger from "../utils/logger.mjs";
import * as config from "../utils/config.mjs";
import * as openai from "../actions/openai.mjs";
import * as event from "../actions/event.mjs";
import * as relay from "../actions/relay.mjs";
env.config();

/**
 * @summary Show help message
 */
const cmdHelp = (match, ev) => {
  var str = "";
  str += "使い方を表示するわ。\n";
  str += "help|ヘルプ|へるぷ : このメッセージを表示するわ。\n";

  const reply = event.create("reply", str, ev);
  relay.publish(reply);
};

/**
 * @summary Post a news review
 */
const cmdCycTalk = () => {
  //cmdNews((str) => {
  //  const post = event.create("post", str);
  //  relay.publish(post);
  //});
};

/**
 * @summary Command Regex and callback correspondence table
 */
const routeMap = [
  [/(help|ヘルプ|へるぷ)/g, true, cmdHelp],
];

/**
 * @summary Reply the response by OpenAI
 */
const cmdOpenAI = (ev) => {
  openai.send(
    (str) => {
      logger.debug("prompt reply: " + str);
      const reply = event.create("reply", str, ev);
      relay.publish(reply);
    },
    config.BOT_INITIAL_PROMPT + config.BOT_REPLY_PROMPT + ev.content,
    "gpt-4"
  );
};

/**
 * @summary Subscribe callback
 */
const callback = (ev) => {
  logger.debug("[subscribe]");
  logger.debug(JSON.stringify(ev));

  switch (ev.kind) {
    case 1:
      for (const [regex, enabled, routeCallback] of routeMap) {
        if (!enabled) {
          continue;
        }

        const match = ev.content.match(regex);
        if (match) {
          routeCallback(match, ev);
          return;
        }
      }

      cmdOpenAI(ev);
      break;
  }
};

/**
 * @summary Connect to relay.
 */
export async function connect() {
  const relayUrl = "wss://relay-jp.nostr.wirednet.jp";

  // Initialize relay
  relay.init(relayUrl, config.BOT_PRIVATE_KEY_HEX);
}

/**
 * @summary Perform relay connection processing and event initialization
 */
export async function init() {
  await connect();

  event.init(config.BOT_PRIVATE_KEY_HEX);

  // Post a startup message
  const runPost = event.create("post", "おはよう。");
  relay.publish(runPost);

  // Post a talk review every 6 hours
  cron.schedule("0 */6 * * *", () => cmdCycTalk());

  process.on("SIGINT", () => {
    logger.info("SIGINT");
    const exitPost = event.create("post", "寝るわ。(SIGINT)");
    relay.publish(exitPost);
    process.exit(0);
  });

  process.on("SIGHUP", () => {
    logger.info("SIGHUP");
    const exitPost = event.create("post", "寝るわ。(SIGHUP)");
    relay.publish(exitPost);
    process.exit(1);
  });

  process.on("SIGTERM", () => {
    logger.info("SIGTERM");
    const exitPost = event.create("post", "寝るわ。(SIGTERM)");
    relay.publish(exitPost)
    process.exit(1);
  });

  relay.subscribe(callback);

  // Post talk on startup
  cmdCycTalk();
}
