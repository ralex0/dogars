import BasicHandler from "./BasicHandler";
import { BattleEvents } from "../PSMessage";

let banlist = [
	'ctrl',
	'close',
	'alt',
	'f4',
	'forfeit',
	'kill',
	'pedo',
	'hentai',
	'dogars'
];

export default class GreetingHandler extends BasicHandler {
	private hi: string[] = [];

	async j(mes: BattleEvents['j']) {
		if (!this.hi.includes(mes[1]) && mes[1].toLowerCase().substr(1) == 'roxle') {
			this.account.message(this.roomname, `Hi ${mes[1]}!`);
			this.hi.push(mes[1]);
		}
	}

	async c(m: BattleEvents['c']) {
		let norm = m[2].toLowerCase();
		if (banlist.find(w => m[1].includes(w)))
			return;
		if (!norm.includes('hi dogars-chan'))
			return;
		if (this.hi.includes(m[1]))
			return;
		this.hi.push(m[1]);
		this.account.message(this.roomname, `Hi ${m[1]}!`);
	}
}
