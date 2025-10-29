import TelegramBot from "node-telegram-bot-api";
import dotenv from "dotenv";
dotenv.config();
// Replace 'YOUR_BOT_TOKEN' with your actual bot token from BotFather
const token = process.env.BOT_TOKEN;

import { getTokenMetadata } from "@solana/spl-token";
import { Connection, PublicKey } from "@solana/web3.js";
import parseTransaction from "./transactionParsing.js";

const API_KEY = process.env.API_KEY;
const CLUSTER = process.env.CLUSTER;
console.log(`Using cluster: ${CLUSTER}`);
const connection = new Connection(getClusterUrl(CLUSTER));
const WaitTime = Number(process.env.WAIT_TIME || 1);
const WalletAddress = process.env.WALLET_ADDRESS;
const whitelistedChatIds = ["1745593112"];

let currentLatestPoolCreationTransactionSignature = null;
let tokenInfo = null;

function getClusterUrl(cluster) {
  switch (cluster) {
    case "DEVNET":
      return `https://devnet.helius-rpc.com/?api-key=${API_KEY}`;
    case "MAINNET":
      return `https://mainnet.helius-rpc.com/?api-key=${API_KEY}`;
    case "LOCALNET":
      return `http://127.0.0.1:8899`;
    default:
      throw new Error("Invalid cluster");
  }
}

async function getToken2022Metadata(mintAddress) {
  try {
    const mintPubkey = new PublicKey(mintAddress);

    // Get the metadata directly from the mint account
    const tokenMetadata = await getTokenMetadata(connection, mintPubkey);

    if (tokenMetadata) {
      return {
        name: tokenMetadata.name,
        symbol: tokenMetadata.symbol,
        uri: tokenMetadata.uri,
        additionalMetadata: tokenMetadata.additionalMetadata,
      };
    } else {
      console.log("No metadata found for this Token-2022 mint.");
    }
  } catch (error) {
    console.error(`Error fetching token metadata: ${error.name}`);
  }
}

// Helper function to convert Unix timestamp to IST
function formatTimestamp(unixTimestamp) {
  if (!unixTimestamp) return { unix: "N/A", ist: "N/A" };

  const date = new Date(unixTimestamp * 1000);

  // IST is UTC+5:30
  const istOffset = 5.5 * 60 * 60 * 1000; // 5 hours 30 minutes in milliseconds
  const istDate = new Date(date.getTime() + istOffset);

  // Format: YYYY-MM-DD HH:MM:SS IST
  const istString =
    istDate.toISOString().replace("T", " ").replace("Z", "").slice(0, 19) +
    " IST";

  return {
    unix: unixTimestamp,
    ist: istString,
  };
}

const parseWallet = async (walletAddress, notify) => {
  const pubkey = new PublicKey(walletAddress);
  console.log(`Parsing Started for wallet: ${walletAddress}`);
  while (true) {
    try {
      let getLatestTransaction = await connection.getSignaturesForAddress(
        pubkey,
        {
          limit: 1,
        }
      );

      // Check if we have transactions
      if (!getLatestTransaction || getLatestTransaction.length === 0) {
        console.log("No transactions found yet...");
        await new Promise((resolve) => setTimeout(resolve, WaitTime * 1000));
        continue;
      }

      let transaction = getLatestTransaction[0];

      if (
        transaction?.memo?.includes("Pool creation with additional signer") &&
        transaction.signature !== currentLatestPoolCreationTransactionSignature
      ) {
        console.log("Transaction found at:", Math.floor(Date.now() / 1000));

        currentLatestPoolCreationTransactionSignature = transaction.signature;

        const findMintResult = await parseTransaction(
          currentLatestPoolCreationTransactionSignature,
          connection
        );

        if (findMintResult && findMintResult.status) {
          // Fetch token name AND symbol from metadata
          tokenInfo = await getToken2022Metadata(findMintResult.mintAddress);
          // Format timestamp
          const timeInfo = formatTimestamp(transaction.blockTime);
          const details = `MINT DETAILS 🎉\n ⚡Transaction: ${
            transaction.signature
          }\n💰Mint Address: ${findMintResult.mintAddress}\n🤵Token Name: ${
            tokenInfo?.name || "N/A"
          }\n🔑Token Symbol: ${
            tokenInfo?.symbol || "N/A"
          }\n📅Creation Time (Unix): ${timeInfo.unix}\n📅Creation Time (IST): ${
            timeInfo.ist
          }`;
          console.log(details);
          if (typeof notify === "function") {
            await notify(details);
          }
        }
      } else {
        // Wait 1 second before next query
        await new Promise((resolve) => setTimeout(resolve, WaitTime * 1000));
      }
    } catch (error) {
      console.log("Error Parsing Transaction", error.name);
      await new Promise((resolve) => setTimeout(resolve, WaitTime * 1000));
    }
  }
};

async function main() {
  console.log("Bot is running...");

  const bot = new TelegramBot(token, { polling: true });

  if (!WalletAddress) {
    console.warn("WALLET_ADDRESS not set; skipping parser startup.");
  } else if (!whitelistedChatIds || whitelistedChatIds.length === 0) {
    console.warn(
      "No whitelistedChatIds configured; parser will log to console only."
    );
  }

  // Start background parsing loop (non-blocking)
  if (WalletAddress) {
    void parseWallet(WalletAddress, async (text) => {
      try {
        if (whitelistedChatIds && whitelistedChatIds.length > 0) {
          console.log("Parsing of wallet started...");
          for (const chatId of whitelistedChatIds) {
            await bot.sendMessage(chatId, text);
          }
        }
      } catch (e) {
        console.error("Failed to send Telegram message:", e?.message || e);
      }
    });
  }
  // Listen for any message
  bot.on("message", (msg) => {
    const chatId = msg.chat.id;
    const message = msg.text;
    console.log(`Received message: ${message} from chat ${chatId}`);
    if (whitelistedChatIds.includes(chatId.toString())) {
      bot.sendMessage(chatId, "hi");
    }
  });

  // Handle errors
  bot.on("polling_error", (error) => {
    console.error("Polling error:", error);
  });
}
main();
