import BasicHandler from "./BasicHandler";
import { BattleEvents, Username } from "../PSMessage";
import { Player } from "../Player";
import { snooze } from "../../Website/utils";
import fs = require('fs');
import { settings } from "../../Backend/settings";
const fsp = fs.promises;
import request = require('request-promise-native');
import { Agent } from "https";
import { proxyList } from "./proxyProvider";
let httpsagent = require('https-proxy-agent');
let socksagent = require('socks-proxy-agent');
let randn = (n: number) => ~~(Math.random() * n);

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

let testProxy = async (proxy: string) => {
	console.log('testing', proxy);
	let agent: Agent;
	if (proxy.indexOf('http') == 0)
		agent = new httpsagent(proxy);
	else
		agent = new socksagent(proxy);
	try {
		let res = await request.get('http://sim2.psim.us/showdown', {
			agent,
			timeout: 8000
		});
		console.log('got answer', res);
		return res == 'Welcome to SockJS!\n';
	} catch (e) {
		console.log(e);
		return false;
	}

}

export let nextWorkingProxy = async (prune = true) => {
	let proxies = proxyList();
	let used: String = '';
	try {
		let buff = await fsp.readFile(settings.ressources + '/used.txt');
		used = buff.toString();
	} catch (e) {
	}
	let p = await proxies.next();
	while (!p.done && !used.includes(p.value)) {
		if (await testProxy(p.value)) {
			break;
		}
		p = await proxies.next();
	}
	if (p.done) { // no proxies 
		return;
	}
	let ret = p.value;
	if (prune)
		await fsp.writeFile(settings.ressources + '/used.txt', used + ret + '\n');
	return ret;
}

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
			let prox = await nextWorkingProxy();
			if (!prox) // no available proxy;
				return;
			let ranpl = new Player(freeforms[randn(freeforms.length)] + '-' + freeforms[randn(freeforms.length)] + randn(100), undefined, prox);
			await ranpl.connect();
			try {
				ranpl.tryJoin(this.roomname);
				await snooze(1000);
				for (let line of pasta) {
					if (line != '') // empty lines are used for timings
						ranpl.message(this.roomname, line);
					await snooze(1000);
				}
				this.bantered = true;
				ranpl.tryLeave(this.roomname);
			} catch (e) {
				ranpl.disconnect();
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
		if (norm == 'oh look, a janny') {
			this.banter();
		}
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
