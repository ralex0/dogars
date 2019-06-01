import request = require('request-promise-native');

import { PSConnection } from './PSConnection';
import { ShowdownMon } from './ShowdownMon';
import { PSRequest, PSEventType, GlobalEventsType, ConnectionRequest, PSRoomRequest, PSRoomMessageRequest, BattleEventsType } from './PSMessage';
import fs = require('fs');
import { settings } from '../Backend/settings';
import { toId } from '../Website/utils';
import { RoomID } from './PSRoom';
import { Agent } from 'https';

let httpsagent = require('https-proxy-agent');
let socksagent = require('socks-proxy-agent');

let sids: { [key: string]: { sid: string, exp: number } } = {};

let sidsfile = settings.ressources + '/sids.json';
if (fs.existsSync(sidsfile))
	sids = JSON.parse(fs.readFileSync(sidsfile).toString());

export enum LoginError {
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
		timeout: 10000,
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

export let _getassertion = async (user: string, pass: string | undefined, challenge: string, proxy?: Agent): Promise<[string, string]> => {
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
		timeout: 10000,
		jar: jar,
		agent: proxy
	});
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

export let getassertion = async (user: string, pass: string | undefined, challenge: string, proxy?: Agent): Promise<[string, string]> => { 
	try {
		return await _getassertion(user, pass, challenge, proxy);
	} catch (e) {
		console.log('ass failed, attempting without proxy...');
		return await _getassertion(user, pass, challenge, undefined);
	}
}

export class Player {
	con: PSConnection;
	user?: string;
	pass?: string;
	sid?: string;
	teamCache: Map<string, ShowdownMon[]> = new Map<string, ShowdownMon[]>();
	guest = false;
	agent?: Agent;

	constructor(user?: string, pass?: string, proxy?: string) {
		console.log('createing', user);
		let regged = pass !== undefined;
		this.guest = !regged && user === undefined;
		this.user = user;
		this.pass = pass;

		let agent: Agent | undefined;
		if (proxy) {
			if (proxy.indexOf('http') == 0)
				agent = new httpsagent(proxy);
			else
				agent = new socksagent(proxy);

		}
		this.agent = agent;

		this.con = new PSConnection(agent);
	}

	async connect() {
		this.con.onstart = async () => {
			let challstr: string = this.con.challstrraw;
			let sid;

			let now = Date.now();
			if (sids[toId(this.user)]) {
				if (sids[toId(this.user)].exp > +now) {
					sid = sids[toId(this.user)].sid;
				}
			}
			let assertion: string | undefined;
			if (sid) {
				try {
					assertion = await upkeep(sid, challstr);
				} catch (e) {
					console.log('Failed to reuse sid, relogin in...', e);
				}
			}
			if (!assertion) {
				try {
					console.log('getting ass for', this.user);
					[sid, assertion] = await getassertion(this.user!, this.pass, challstr, this.agent);
				} catch (e) {
					console.log('failed getting ass for', this.user, e);
					if (e == LoginError.MalformedAssertion)
						[sid, assertion] = await getassertion(this.user!, this.pass, challstr, this.agent);
					else {
						throw new Error("Shit broke");
					}
				}
				let exp = now + 6 * 30 * 24 * 60 * 60 * 1000; // expires in 6 months
				sids[toId(this.user)] = { sid, exp };
				fs.writeFile(sidsfile, JSON.stringify(sids), () => console.log(`saved session for ${this.user}`));
			}
			let connected = await this.request(new ConnectionRequest(this.user!, assertion));
			if (connected) {
				console.log('Successfully logged in');
			}
		}
		await this.con.start();
		console.log('AWAIT STARTING CONNE');
	}

	tryJoin(room: RoomID) {
		return this.con.joinRoom(room);
	}

	tryLeave(room: string) {
		return this.con.leaveRoom(room);
	}

	async message(room: RoomID, str: string) {
		this.tryJoin(room);
		await this.request(new PSRoomMessageRequest(room, str));
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

	request<T extends GlobalEventsType | BattleEventsType, R>(req: PSRequest<T, R>) {
		return this.con.request(req);
	}

	getBattles() {
		return this.con.rooms.keys();
	}

	disconnect() {
		this.con.close();
	}
}
