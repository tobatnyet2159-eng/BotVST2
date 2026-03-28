const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, fetchLatestBaileysVersion } = require("@whiskeysockets/baileys")
const pino = require("pino")
const { Boom } = require("@hapi/boom")
const qrcode = require("qrcode-terminal")
const fs = require("fs")
const moment = require("moment-timezone")

// Pastiin Database Ada biar gak error ENOENT
if (!fs.existsSync("./welcome.json")) fs.writeFileSync("./welcome.json", "{}")
if (!fs.existsSync("./goodbye.json")) fs.writeFileSync("./goodbye.json", "{}")

async function startVST() {
    // Pakai folder sesi baru
    const { state, saveCreds } = await useMultiFileAuthState("./vst_qr_session")
    
    const client = makeWASocket({
        logger: pino({ level: "silent" }),
        auth: state,
        printQRInTerminal: false,
        browser: ["VST-BOT", "Chrome", "3.0.0"]
    })

    client.ev.on("creds.update", saveCreds)

    // Fitur Welcome & Goodbye
    client.ev.on("group-participants.update", async (anu) => {
        const welcomeDB = JSON.parse(fs.readFileSync("./welcome.json"))
        const goodbyeDB = JSON.parse(fs.readFileSync("./goodbye.json"))
        const { id, participants, action } = anu
        for (let num of participants) {
            let userTag = `@${num.split("@")[0]}`
            if (action === "add" && welcomeDB[id]) {
                client.sendMessage(id, { text: welcomeDB[id].replace("@user", userTag), mentions: [num] })
            } else if (action === "remove" && goodbyeDB[id]) {
                client.sendMessage(id, { text: goodbyeDB[id].replace("@user", userTag), mentions: [num] })
            }
        }
    })

    // Command Handler
    client.ev.on("messages.upsert", async ({ messages }) => {
        const msg = messages[0]
        if (!msg.message || msg.key.fromMe) return
        const from = msg.key.remoteJid
        const body = (msg.message.conversation || msg.message.extendedTextMessage?.text || "")
        const prefix = "."
        const isCmd = body.startsWith(prefix)
        const command = isCmd ? body.slice(prefix.length).trim().split(/ +/).shift().toLowerCase() : ""
        const args = body.trim().split(/ +/).slice(1)
        const q = args.join(" ")

        if (isCmd) {
            switch(command) {
                case "menu":
                    const menu = `*VST-BOT MD*\n\n` +
                        `🕒 *Waktu:* ${moment().tz("Asia/Jakarta").format("HH:mm:ss")}\n` +
                        `> ${prefix}ping\n` +
                        `> ${prefix}runtime\n` +
                        `> ${prefix}setwelcome [teks]\n` +
                        `> ${prefix}setgoodbye [teks]`
                    client.sendMessage(from, { text: menu }, { quoted: msg })
                    break
                case "ping":
                    client.sendMessage(from, { text: "Pong! Bot Active ⚡" })
                    break
                case "runtime":
                    const uptime = process.uptime()
                    client.sendMessage(from, { text: `Runtime: ${Math.floor(uptime/3600)}j ${Math.floor((uptime%3600)/60)}m` })
                    break
            }
        }
    })

    client.ev.on("connection.update", (update) => {
        const { connection, lastDisconnect, qr } = update
        if (qr) {
            console.clear()
            console.log("=== SCAN QR DI BAWAH INI ===")
            qrcode.generate(qr, { small: true })
        }
        if (connection === "close") {
            const reason = new Boom(lastDisconnect?.error)?.output.statusCode
            if (reason !== DisconnectReason.loggedOut) startVST()
        } else if (connection === "open") {
            console.log("✅ BOT BERHASIL CONNECT!")
        }
    })
}

startVST()
