# Telegram Bot

A simple Telegram bot that replies "hi" to any message.

## Setup Instructions

1. **Get a Bot Token:**

   - Open Telegram and search for [@BotFather](https://t.me/BotFather)
   - Send `/newbot` and follow the instructions
   - Copy the bot token you receive

2. **Install Dependencies:**

   ```bash
   npm install
   ```

3. **Configure the Bot:**

   - Copy `env.template` to `.env`
   - Replace `your_bot_token_here` with your actual bot token from BotFather

4. **Run the Bot:**
   ```bash
   npm start
   ```

## Features

- Replies "hi" to any message received
- Can work in both private chats and groups

## Note

Make sure to keep your `.env` file private and never commit it to version control.
