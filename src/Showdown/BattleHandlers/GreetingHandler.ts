import BasicHandler from "./BasicHandler";
import { BattleEvents, Username } from "../PSMessage";
import { snooze } from "../../Website/utils";
import fs = require('fs');
import { settings } from "../../Backend/settings";
const fsp = fs.promises;

let banlist = [
	'ctrl',
	'close',
	'alt',
	'f4',
	'f5',
	'forfeit',
	'kill',
	'pedo',
	'hentai',
	'dogars'
];

let freeforms = [
	'hotpockets',
	'doritos',
	'mtndew',
	'anime',
	'kiddiddler',
	'furfag',
	'npc',
	'fatty',
	'powertrip',
	'garbage',
	'trash'
];

export default class GreetingHandler extends BasicHandler {
	private hi: Username[] = [];

	bantered = false;
	bantering = false;
	async banter() {
		if (this.bantered || this.bantering)
			return;
		this.bantering = true;
		this.account.message(this.roomname, `>he does it for free!`);
		let pastab = await fsp.readFile(settings.ressources + '/pasta.txt');
		let pasta = pastab.toString().split('\n');
		try {
			try {
				for (let line of pasta) {
					if (line != '') // empty lines are used for timings
						this.account.message(this.roomname, line);
					await snooze(1000);
				}
				this.bantered = true;
			} catch (e) {
				throw e;
			}
		} catch (e) {
			console.log('Proxy shitted itself, trying another');
			this.bantering = false;
			this.bantered = false;
			this.banter();
		}
	}

	async j(mes: BattleEvents['j']) {
		if (!this.hi.includes(mes[1]) && mes[1].toLowerCase().substr(1) == 'roxle') {
			this.account.message(this.roomname, `Hi ${mes[1]} ❤️!`);
			this.hi.push(mes[1]);
		}
		if ('%@'.includes(mes[1][0])) {
			this.banter();
		}
	}

	async c(m: BattleEvents['c']) {
		let norm = m[2].toLowerCase();
		if (banlist.find(w => m[1].includes(w)))
			return;
		if (!norm.includes(`hi ${this.account.user}`))
			return;
		if (this.hi.includes(m[1]))
			return;
		this.hi.push(m[1]);
		this.account.message(this.roomname, `Hi ${m[1]}!`);
	}
}
