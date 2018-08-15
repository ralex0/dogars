import request = require('request-promise-native');

import { PSConnection } from './PSConnection';
import { ShowdownMon } from './ShowdownMon';
import { PSRequest, PSEventType, GlobalEventsType } from './PSMessage';
import fs = require('fs');
import { settings } from '../Backend/settings';
import { toId } from '../Website/utils';
import { RoomID } from './PSRoom';
let sids: { [key: string]: { sid: string, exp: number } } = {};

let sidsfile = settings.ressources + '/sids.json';
if (fs.existsSync(sidsfile))
	sids = JSON.parse(fs.readFileSync(sidsfile).toString());

enum LoginError {
	ChallengeFailed,
	UnexpectedResponse,
	MalformedAssertion
};

export class LoginForm {
	challstr: string = '';
	act: string = '';
	name: string = '';
	pass?: string = '';
	userid: string = '';
	oldpassword?: string;
	password?: string;
	cpassword?: string;
}

export let upkeep = async (sid: string, challstr: string) => {
	let data: LoginForm = new LoginForm();
	data.challstr = challstr;
	data.act = 'upkeep';
	let body = await request.post('http://play.pokemonshowdown.com/action.php', {
		form: data,
		headers: {
			Cookie: `sid=${sid}`
		}
	});
	if (body[0] == ';') {
		throw LoginError.ChallengeFailed;
	}
	if (body[0] != ']')
		throw LoginError.UnexpectedResponse;
	body = body.substr(1);
	body = JSON.parse(body);
	if (!body.assertion || body.assertion[0] == ';') {
		throw LoginError.MalformedAssertion;
	}
	return body.assertion;
}

export let getassertion = async (user: string, pass: string | undefined, challenge: string, proxy?: string): Promise<[string, string]> => {
	let regged = pass !== undefined;
	let data: LoginForm = new LoginForm();
	let jar = request.jar();
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
		form: data,
		jar: jar,
		proxy: proxy
	});
	console.log('===========================', body);
	if (body[0] == ';') {
		throw LoginError.ChallengeFailed;
	}
	if (regged) {
		if (body[0] != ']')
			throw LoginError.UnexpectedResponse;
		body = body.substr(1);
		body = JSON.parse(body);
		if (body.assertion[0] == ';') {
			throw LoginError.MalformedAssertion;
		}
		let cookies = jar.getCookies('http://pokemonshowdown.com/');
		cookies = cookies.filter(c => c.key == 'sid');
		return [cookies[0].value, body.assertion];
	}
	else if (body.length > 10)
		return ['', body];
	throw LoginError.MalformedAssertion;
}

export class Player {
	con: PSConnection;
	user?: string;
	pass?: string;
	sid?: string;
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
		let sid;

		let now = Date.now();
		if (sids[toId(this.user)]) {
			if (sids[toId(this.user)].exp > +now) {
				sid = sids[toId(this.user)].sid;
			}
		}

		let assertion;
		if (sid) {
			try {
				assertion = await upkeep(sid, challstr);
			} catch(e) {
				console.log('Failed to reuse sid, relogin in...', e);
			}
		}
		if (!assertion) {
			try {
				throw LoginError.MalformedAssertion;
				[sid, assertion] = await getassertion(this.user!, this.pass, challstr);
			} catch (e) {
				console.log('threw', e);
				if (e == LoginError.MalformedAssertion)
					[sid, assertion] = await getassertion(this.user!, this.pass, challstr, settings.proxy);
				else
					throw e;
			}
			let exp = now + 6 * 30 * 24 * 60 * 60 * 1000; // expires in 6 months
			sids[toId(this.user)] = { sid, exp };
			fs.writeFile(sidsfile, JSON.stringify(sids), () => console.log(`saved session for ${this.user}`));
		}
		console.log(sid, assertion);
		this.con.send(`|/trn ${this.user},0,${assertion}`);
	}

	tryJoin(room: RoomID) {
		return this.con.joinRoom(room);
	}

	tryLeave(room: string) {
		return this.con.leaveRoom(room);
	}

	message(room: RoomID, str: string) {
		this.tryJoin(room);
		this.con.send(`${room}|${str}`);
	}

	forfeit(battle: RoomID) {
		this.message(battle, '/forfeit');
	}

	setTeam(team: string) {
		this.message('' as RoomID, `/utm ${team}`);
	}

	async getMyTeam(battle: RoomID) {
		this.tryJoin(battle);
		if (this.teamCache && this.teamCache.has(battle))
			return this.teamCache.get(battle);
		let room = this.con.rooms.get(battle)!;
		let event = await room.read('request');
		try {
			let req = JSON.parse(event[1]);
			if (!req.side || !req.side.pokemon)
				throw 'No side pokemons';
			this.teamCache.set(battle, req.side.pokemon!);
		} catch (e) {
			console.log('could not set team:', e);
		}
		return this.teamCache.get(battle);
	}

	request<T extends GlobalEventsType, R>(req: PSRequest<T, R>) {
		return this.con.request(req);
	}

	getBattles() {
		return this.con.rooms.keys();
	}

	disconnect() {
		this.con.close();
	}
}
