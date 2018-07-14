import request = require('request-promise-native');

import { PSConnection } from './PSConnection';
import { ShowdownMon } from './ShowdownMon';
import { PSRequestMessage, PSRequest } from './PSMessage';

let headers = {
	'accept': '*/*',
	'accept-language': 'en-US,en;q=0.8,fr;q=0.6,ja;q=0.4,de;q=0.2',
	'content-type': 'application/x-www-form-urlencoded; charset=UTF-8',
	'dnt': '1',
	'origin': 'https://play.pokemonshowdown.com',
	'referer': 'https://play.pokemonshowdown.com/crossprotocol.html?v1.2',
	'user-agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/58.0.3029.110 Safari/537.36',
	'x-requested-with': 'XMLHttpRequest'
}

export class LoginForm {
	challstr: string = '';
	act: string = '';
	name: string = '';
	pass?: string = '';
	userid: string = '';
}

export let getchallstr = async (user: string, pass: string | undefined, challenge: string) => {
	let regged = pass !== undefined;
	let data: LoginForm = new LoginForm();
	data.challstr = challenge;
	if (regged) {
		data.act = 'login';
		data.name = user;
		data.pass = pass;
	} else {
		data.act = 'getassertion';
		data.userid = user;
	}
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data
	});
	if (body[0] == ';') {
		throw 'Issue with challenge';
	}
	if (regged) {
		if (body[0] != ']')
			throw 'Issue with login1';
		body = body.substr(1);
		body = JSON.parse(body);
		if (body.assertion[0] == ';') {
			throw 'Issue with login2';
		}
		return body.assertion;
	}
	else if (body.length > 10)
		return body;
	throw 'Issue with login3';
}

export class Player {
	con: PSConnection;
	user?: string;
	pass?: string;
	teamCache: Map<string, ShowdownMon[]> = new Map<string, ShowdownMon[]>();
	guest = false;

	constructor(user?: string, pass?: string) {
		this.con = new PSConnection();
		let regged = pass !== undefined;
		this.guest = !regged && user === undefined;
		this.user = user;
		this.pass = pass;
	}

	async connect() {
		await this.con.start();
		if (this.guest)
			return;
		let challstr: string = this.con.challstrraw;
		let assertion: string = await getchallstr(this.user!, this.pass, challstr);
		this.con.send(`|/trn ${this.user},0,${assertion}`);
	}

	tryJoin(room: string) {
		return this.con.joinRoom(room);
	}

	tryLeave(room: string) {
		return this.con.leaveRoom(room);
	}

	message(room: string, str: string) {
		this.tryJoin(room);
		this.con.send(`${room}|${str}`);
	}

	forfeit(battle: string) {
		this.message(battle, '/forfeit');
	}

	setTeam(team: string) {
		this.message('', `/utm ${team}`);
	}

	async getMyTeam(battle: string) {
		this.tryJoin(battle);
		if (this.teamCache && this.teamCache.has(battle))
			return this.teamCache.get(battle);
		let room = this.con.rooms.get(battle)!;
		let event = await room.read({
			name: 'request'
		}) as PSRequestMessage;
		this.teamCache.set(battle, event.side.pokemon!);
		return this.teamCache.get(battle);
	}

	request(req: PSRequest<any>) {
		return this.con.request(req);
	}

	getBattles() {
		return this.con.rooms.keys();
	}

	disconnect() {
		this.con.close();
	}
}
