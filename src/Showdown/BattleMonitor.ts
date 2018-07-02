import { PSRoom } from './PSRoom';
import { PSLeaveMessage, PSWinMessage, PSChatMessage, PSJoinMessage, PSPlayerDecl, PSSwitchMessage, PSFaintMessage, PSMessage, PSBattleMessage } from './PSMessage';
import { Player } from './Player';
import { connection, PSConnection } from './PSConnection';
import { PlayerHijack } from './PlayerHijack';
import { BattleData } from './BattleData'

import { registerChampResult } from '../Backend/mongo';
import { logger } from '../Backend/logger';
import { CringCompilation } from '../Backend/CringeCompilation';

import { Champ } from '../Shoedrip/Champ'

import { levenshtein, snooze } from '../Website/utils';

export class BattleMonitor {
	[_: string]: any;
	con: Player;
	reg: boolean;
	stopped: boolean;
	attemptedJack: boolean = false;
	battleData: BattleData;
	champ: Champ;
	room: PSRoom;
	battlers: Map<string, Champ> = new Map<string, Champ>();
	compiler: CringCompilation;
	cringeReady: boolean = false;
	hi: string[] = [];
	filter: { [key: string]: number | undefined } = {};

	constructor(pchamp: Champ, isreg: boolean = true) {
		this.con = connection;
		this.reg = isreg === undefined ? true : isreg;
		this.stopped = false;
		this.champ = pchamp;
		this.champ.avatar = '166';
		this.battleData = new BattleData();
		this.battleData.champ = this.champ;
		this.battleData.memes = [];
		this.battleData.dist = 100;
		this.compiler = new CringCompilation(this.champ.current_battle);
		this.battleData.roomid = this.champ.current_battle.match(/battle-(.*)\/?/)![0];
		this.room = this.con.tryJoin(this.champ.current_battle.match(/(battle-.*)\/?/)![0]);
		//		this.room = this.con.joinRoom();

		this.compiler.init().then(async () => {
			await snooze(5000);
			this.cringeReady = true;
		});
	}

	async j(mes: PSJoinMessage) {
		if (!this.hi.includes(mes.username) && mes.username.indexOf('Roxle') > -1) {
			this.con.message(this.room.room, `Hi ${mes.username}!`);
			this.hi.push(mes.username);
		}
	}

	async inactive(mes: PSJoinMessage) {
		return;
	}

	async c(mes: PSChatMessage) {
		let norm = mes.content.toLowerCase();
		let mapper = [{
			test: /hi dogars-?chan/i,
			fun: async () => {
				if (this.hi.includes(mes.username))
					return;
				this.hi.push(mes.username);
				this.con.message(this.room.room, `Hi ${mes.username}!`);
			}
		}, {
			test: /\*sn(a|i)ps?\*/i,
			fun: async () => {
				if (!this.cringeReady)
					return;
				if (mes.username.includes('dogars'))
					return;
				let usertests = this.filter[mes.username] || 0;
				if (usertests >= 3)
					return;
				this.filter[mes.username] = usertests + 1;
				await this.compiler.snap();
				this.con.message(this.room.room, "Yep. This one's going in my cringe compilation.");
			}
		}];
		for (let r of mapper)
			if (r.test.test(norm))
				await r.fun();
	}

	async monitor() {
		while (!this.stopped) {
			let event = await this.room.read();
			if (this[event.name])
				await this[event.name].apply(this, [event]);
		}
	}

	async l(left: PSLeaveMessage) {
		if (this.battleData.finished)
			return;

		let oppo_name;
		let oppo_alias;
		oppo_alias = (this.battlers.get('p1')!.showdown_name == this.battleData.champ!.showdown_name) ? 'p2' : 'p1';
		if (this.battlers.get(oppo_alias)!.jacked)
			return;
		oppo_name = this.battlers.get(oppo_alias)!.showdown_name!;
		if (left.username.indexOf(oppo_name) == 0 || left.username.indexOf(oppo_name) == 1) {
			if (this.attemptedJack)
				return;
			this.attemptedJack = true;
			let hj = new PlayerHijack(this.battleData, this.battlers);
			// todo: check if opponent is regged here
			// possible source of crash
			hj.tryJack(false);
		}
	}

	async win(winner: PSWinMessage) {
		this.battleData.memes = this.battlers.get(this.battleData.champ_alias!)!.team!;
		if (this.reg)
			await registerChampResult(this.battleData, this.battleData.champ!.showdown_name == winner.username);
		this.stopped = true;
		this.con.tryLeave(this.room.room);
		await this.compiler.cleanup();
	}

	async player(pl: PSPlayerDecl) {
		if (pl.showdown_name == '')
			return;
		let nc = new Champ();
		nc.showdown_name = pl.showdown_name;
		nc.avatar = pl.avatar;

		this.battlers.set(pl.alias, nc);
		let dist = levenshtein(this.battleData.champ!.name || '', pl.showdown_name);
		if (dist < this.battleData.dist!) {
			this.battleData.champ!.showdown_name = pl.showdown_name;
			this.battleData.champ!.avatar = pl.avatar;
			this.battleData.champ_alias = pl.alias;
			this.battleData.dist = dist;
		}
	}

	async "switch"(sw: PSSwitchMessage) {
		if (this.battleData.dist! >= 3) {
			let name = sw.nick.split(': ')[1].trim();
			let forme = sw.status.split(',')[0].split('-')[0].trim();
			if (forme != name) {
				this.battleData.dist = 0;
				this.battleData.champ_alias = sw.nick.split(': ')[0].substr(0, 2);
				this.battleData.champ!.showdown_name = this.battlers.get(this.battleData.champ_alias!)!.showdown_name;
				this.battleData.champ!.avatar = this.battlers.get(this.battleData.champ_alias!)!.avatar;
			}
		}
		if (sw.nick.indexOf(this.battleData.champ_alias!) == 0) {
			let memename = sw.nick.substr(5);
			this.battleData.active_meme = memename;
			let exists = this.battlers.get(this.battleData.champ_alias!)!.team.some(mon => mon.name == memename);
			if (!exists)
				this.battlers.get(this.battleData.champ_alias!)!.team.push({ name: memename, kills: 0, dead: false })
		}
	}

	async faint(fainted: PSFaintMessage) {
		if (fainted.nick.indexOf(this.battleData.champ_alias!) == 0) {
			let memename = fainted.nick.substr(5);
			for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
				if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == memename)
					this.battlers.get(this.battleData.champ_alias!)!.team[i].dead = true;
		} else {
			for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
				if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == this.battleData.active_meme)
					this.battlers.get(this.battleData.champ_alias!)!.team[i].kills++;
		}
	}
}
