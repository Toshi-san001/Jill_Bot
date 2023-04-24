const { join } = require('path')
const { readdirSync } = require('fs-extra')
const chalk = require('chalk')
const Message = require('../Structures/Message')
const Helper = require('../Structures/Helper')
const Command = require('../Structures/Command')
const { Stats } = require('../lib')
const { ICharacter, Character } = require('@shineiichijo/marika');


module.exports = class MessageHandler {
    /**
     * @param {client} client
     * @param {Helper} helper
     */
    constructor(client, helper) {
        /**
         * @type {client}
         */
        this.client = client
        /**
         * @type {Helper}
         */
        this.helper = helper
    }

//     loadCharaEnabledGroups = async ()=> {
//        const getGroups = await this.client.groupFetchAllParticipating()
//     //     const groups = Object.entries(getGroups)
//     //         .slice(0)
//     //         .map((entry) => entry[1])
//     //     let lengthOfCharacter = this.helper.DB.group.CharacterData
//     //     // const groups = !this.groups ? await this.client.groupFetchAllParticipating() : this.groups
//     //     if (!groups) return void null // add this check
//     //     for (const group of groups) {
//     //         lengthOfCharacter.push(group)
//     //     }
//     //     this.client.log(
//     //         `Successfully loaded ${chalk.blueBright(`${lengthOfCharacter.length}`)} ${
//     //             lengthOfCharacter.length > 1 ? 'groups' : 'group'
//     //         } which has enabled chara`
//     //     )
//     //     await this.spawnChara()
//     // }
//      let getAllGroups = Object.keys(await this.client.groupFetchAllParticipating());

//     //  let characterOfMe = this.helper.DB.group.CharacterData
//     const characterOfMe = this.helper.DB.characterData


//     const groups = await getAllGroups
//     for (const group of groups) {
//         const data = await this.helper.DB.getGroup(group)
//         if (!data.chara) continue
//         this.helper.DB.group.CharacterData.push(group)
//     }
//     this.client.log(
//         `Successfully loaded ${chalk.blueBright(`${characterOfMe.length}`)} ${
//             characterOfMe.length > 1 ? 'groups' : 'group'
//         } which has enabled chara`
//     )
//     await this.spawnChara()
// }

   spawnChara = async () => {
        schedule('*/1 * * * *', async () => {
            if (this.helper.DB.group.CharacterData.length < 1) return void null
            for (let i = 0; i < this.helper.DB.group.CharacterData.length; i++) {
                setTimeout(async () => {
                    const { chara, bot } = await this.helper.DB.getGroup(this.helper.DB.group.wild[i])
                    if (bot !== 'all' && bot !== process.env.NAME.split(' ')[0]) return void null
                    if (!chara) return void null
                    await new Character()
                        .getRandomCharacter()
                        .then(async (chara) => {
                            const price = Math.floor(Math.random() * (50000 - 25000) + 25000)
                            let source = ''
                            await new Character()
                                .getCharacterAnime(chara.mal_id)
                                .then((res) => (source = res.data[0].anime.title))
                                .catch(async () => {
                                    await new Character()
                                        .getCharacterManga(chara.mal_id.toString())
                                        .then((res) => (source = res.data[0].manga.title))
                                        .catch(() => {})
                                })
                            const buffer = await this.helper.utils.getBuffer(chara.images.jpg.image_url)
                            const buttons = [
                                {
                                    buttonId: 'id1',
                                    buttonText: { displayText: `${process.env.PREFIX}claim` },
                                    type: 1
                                }
                            ]
                            const buttonMessage = {
                                image: buffer,
                                caption: `*A claimable character Appeared!*\n\n🏮 *Name: ${chara.name}*\n\n📑 *About:* ${chara.about}\n\n💮 *Source: ${source}*\n\n🪙 *Price: ${price}*\n\n*[Use ${this.helper.config.prefix}claim to have this character in your gallery]*`,
                                footer: '',
                                buttons: buttons,
                                headerType: 4
                            }
                            this.charaResponse.set(this.helper.DB.group.CharacterData[i], { price, data: chara })
                            await this.client.sendMessage(this.helper.DB.group.CharacterData[i], buttonMessage)
                        })
                        .catch(() => {})
                }, (i + 1) * 20 * 1000)
            }
        })
    }

    /**
     * @param {Message} m
     * @returns {Promise<void>}
     */

    handleMessage = async (m) => {
        const { prefix } = this.helper.config
        const args = m.content.split(' ')
        let title = 'DM'
        if (m.chat === 'group') {
            try {
                const { subject } = await this.client.groupMetadata(m.from)
                title = subject || 'Group'
            } catch (error) {
                title = 'Group'
            }
        }
        if (!args[0] || !args[0].startsWith(prefix))
            return void this.helper.log(
                `${chalk.cyanBright('Message')} from ${chalk.yellowBright(m.sender.username)} in ${chalk.blueBright(
                    title
                )}`
            )
        this.helper.log(
            `${chalk.cyanBright(`Command ${args[0]}[${args.length - 1}]`)} from ${chalk.yellowBright(
               m.sender.username
            )} in ${chalk.blueBright(title)}`
        )
        const { ban, tag } = await this.helper.DB.getUser(m.sender.jid)
        if (ban) return void m.reply('You are banned from using commands')
        if (!tag)
            await this.helper.DB.user.updateOne(
                { jid: m.sender.jid },
                { $set: { tag: this.helper.utils.generateRandomUniqueTag(4) } }
            )
        const cmd = args[0].toLowerCase().slice(prefix.length)
        const command = this.commands.get(cmd) || this.aliases.get(cmd)
        if (!command) return void m.reply('No such command, Baka!')
        const disabledCommands = await this.helper.DB.getDisabledCommands()
        const index = disabledCommands.findIndex((CMD) => CMD.command === command.name)
        if (index >= 0)
            return void m.reply(
                `*${this.helper.utils.capitalize(cmd)}* is currently disabled by *${
                    disabledCommands[index].disabledBy
                }* in *${disabledCommands[index].time} (GMT)*. ❓ *Reason:* ${disabledCommands[index].reason}`
            )
        if (command.config.category === 'dev' && !this.helper.config.mods.includes(m.sender.jid))
            return void m.reply('This command can only be used by the MODS')
        if (m.chat === 'dm' && !command.config.dm) return void m.reply('This command can only be used in groups')
        const cooldownAmount = (command.config.cooldown ?? 3) * 1000
        const time = cooldownAmount + Date.now()
        if (this.cooldowns.has(`${m.sender.jid}${command.name}`)) {
            const cd = this.cooldowns.get(`${m.sender.jid}${command.name}`)
            const remainingTime = this.helper.utils.convertMs(cd - Date.now())
            return void m.reply(
                `You are on a cooldown. Wait *${remainingTime}* ${
                    remainingTime > 1 ? 'seconds' : 'second'
                } before using this command again`
            )
        } else this.cooldowns.set(`${m.sender.jid}${command.name}`, time)
        setTimeout(() => this.cooldowns.delete(`${m.sender.jid}${command.name}`), cooldownAmount)
        await this.helper.DB.setExp(m.sender.jid, command.config.exp || 10)
        await this.handleUserStats(m)
        try {
            await command.execute(m, this.formatArgs(args))
        } catch (error) {
            this.helper.log(error.message, true)
        }
 }
    
   

    /**
     * @returns {void}
     */

    loadCommands = () => {
        this.helper.log('Loading Commands...')
        const files = readdirSync(join(__dirname, '..', 'Commands')).filter((file) => !file.endsWith('___.js'))
        for (const file of files) {
            const Commands = readdirSync(join(__dirname, '..', 'Commands', file))
            for (const Command of Commands) {
                /**
                 * @constant
                 * @type {Command}
                 */
                const command = new (require(`../Commands/${file}/${Command}`))()
                command.client = this.client
                command.helper = this.helper
                command.handler = this
                this.commands.set(command.name, command)
                if (command.config.aliases) command.config.aliases.forEach((alias) => this.aliases.set(alias, command))
                this.helper.log(
                    `Loaded: ${chalk.yellowBright(command.name)} from ${chalk.cyanBright(command.config.category)}`
                )
            }
        }
        return this.helper.log(
            `Successfully loaded ${chalk.cyanBright(this.commands.size)} ${
                this.commands.size > 1 ? 'commands' : 'command'
            } with ${chalk.yellowBright(this.aliases.size)} ${this.aliases.size > 1 ? 'aliases' : 'alias'}`
        )
    }

    /**
     * @private
     * @param {string[]} args
     * @returns {args}
     */

    formatArgs = (args) => {
        args.splice(0, 1)
        return {
            args,
            context: args.join(' ').trim(),
            flags: args.filter((arg) => arg.startsWith('--'))
        }
    }

    /**
     * @private
     * @param {Message} m
     * @returns {Promise<void>}
     */

    handleUserStats = async (m) => {
        const { experience, level } = await this.helper.DB.getUser(m.sender.jid)
        const { requiredXpToLevelUp } = Stats.getStats(level)
        if (requiredXpToLevelUp > experience) return void null
        await this.helper.DB.user.updateOne({ jid: m.sender.jid }, { $inc: { level: 1 } })
    }

    /**
     * @type {Map<string, Command>}
     */

    commands = new Map()

    /**
     * @type {Map<string, Command>}
     */

    aliases = new Map()

    /**
     * @type {Map<string, number>}
     */

    cooldowns = new Map()

    /**
 * @typedef {Object} CharacterResponse
 * @property {number} price - The price of the character.
 * @property {ICharacter} data - The character data.
 */

/**
 * @type {Map<string, CharacterResponse>}
 */
 charaResponse = new Map();



    /**
     * @param {{group: string, jid: string}} options
     * @returns {Promise<boolean>}
     */
    

    isAdmin = async (options) => {
        const data = (await this.client.groupMetadata(options.group)).participants
        const index = data.findIndex((x) => x.id === options.jid)
        if (index < -1) return false
        const admin = !data[index] || !data[index].admin || data[index].admin === null ? false : true
        return admin
    }
}

/**
 * @typedef {import('../Structures/Command').client} client
 */

/**
 * @typedef {import('../Structures/Command').config} config
 */

/**
 * @typedef {{context: string, args: string, flags: string[]}} args
 */
