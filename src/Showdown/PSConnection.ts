import { Agent } from 'https';

import { eventToPSMessages, GlobalEventsType, eventToPSBattleMessage, PSRequest, PSRoomRequest, EventsName, PSEvent, PSEventType, BattleEventsType } from './PSMessage';
import { PSRoom, RoomID } from './PSRoom';
import { Player } from './Player';

import { logger } from '../Backend/logger';
import { settings } from '../Backend/settings';
import { SuckJS } from './suckjs';
import { nextWorkingProxy } from './BattleHandlers/GreetingHandler';


export class PSConnection {
	usable: boolean = false;
	onstart?: () => Promise<void>;
	ws!: SuckJS;
	wscache: string[] = [];
	iid?: NodeJS.Timer;
	challstrraw: string = '';
	eventqueue: PSEventType[] = [];
	rooms: Map<string, PSRoom> = new Map<string, PSRoom>();
	messagequeue: MessageEvent[] = [];
	openprom?: () => void;
	openrej?: (d: Error) => void;
	opened = false;
	readprom?: { name?: EventsName, res: (ev: PSEventType) => void };
	requests: ({
		req: PSRequest<any, any>;
		res: (value?: any) => void;
		rej: (value?: any) => void;
	})[] = [];
	errored = false;

	clear() {
		this.iid && clearTimeout(this.iid);
		this.usable = false;
		this.opened = false;
		this.ws && this.ws.close();
		this.ws = new SuckJS('https://sim2.psim.us/showdown', this.proxy);
		this.ws.onmessage = ev => {
			if (ev.data[0] == '>') {
				let { room, events } = eventToPSBattleMessage(ev);
				if (this.rooms.has(room)) {
					if (events instanceof Array)
						events.forEach(e => this.rooms.get(room)!.recv(e));
					else
						this.rooms.get(room)!.recv(events);
				}
			} else {
				let mesgs = eventToPSMessages(ev);
				// remove requests that where handled from the list
				this.requests = this.requests.filter(r => {
					let handled = false;
					// remove messages that where handled by a request
					mesgs = mesgs.filter(e => {
						if (e[0] == 'error' || (e[1] && e[1].startsWith('|modal|Your IP'))) {
							this.errored = true;
							r.rej(e[1]);
							return false;
						}
						let h = r.req.isResponse(e);
						if (h) {
							handled = true;
							r.res(r.req.buildResponse(e));
						}
						return !h;
					});
					return !handled;
				});
				// everything was consumed
				if (mesgs.length == 0)
					return;
				// if something is waiting to read...
				if (this.readprom && mesgs[0][0] == this.readprom.name) {
					this.readprom.res(mesgs.shift()!);
					this.readprom = undefined;
				}
				// push messages that weren't handled yet
				this.eventqueue.push(...mesgs);
			}
		};
		this.ws.onopen = () => {
			this.opened = true;
			this.openprom && this.openprom();
			this.openrej = undefined;
		}

		this.ws.onclose = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej(new Error(e && e.type));
		}

		this.ws.onerror = (e?: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej(new Error(e && e.type));
		}
	}

	proxy?: Agent;
	constructor(proxy?: Agent) {
		this.proxy = proxy;
		//this.clear();
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		if (this.errored)
			throw 'Socket is in an error state';
		this.ws.send(data);
	}

	joinRoom(room: RoomID): PSRoom {
		if (room == '')
			return new PSRoom(this, '' as RoomID);
		if (this.rooms.has(room))
			return this.rooms.get(room)!;
		let ret: PSRoom = new PSRoom(this, room);
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		this.send(`|/join ${room}`);
		this.rooms.set(room, ret);
		return ret;
	}

	leaveRoom(room: string) {
		if (!this.rooms.has(room))
			return;
		let ret: PSRoom = this.rooms.get(room)!;
		ret.send('/leave');
		this.rooms.delete(room);
		return ret;
	}

	// I want to impregnate type systems
	read<T extends EventsName>(name?: T) {
		return new Promise<PSEventType>((res, rej) => {
			if (this.errored)
				return rej('Socket is in an error state');
			if (this.eventqueue.length >= 1) {
				let idx = this.eventqueue.findIndex(m => m[0] == name);
				let elem = this.eventqueue.splice(idx, 1)[0];
				return res(elem as PSEvent[T]);
			}
			this.readprom = { name, res };
		}) as any as PSEvent[T];
	}

	close() {
		this.usable = false;
		this.opened = false;
		if (!this.ws)
			throw 'Attempted to close without initialized socket';
		this.ws.close();
	}

	request<T extends GlobalEventsType | BattleEventsType, R>(req: PSRequest<T, R>): Promise<R> {
		return new Promise<R>((res, rej) => {
			this.send(req.toString());
			this.requests.push({ req, res, rej });
		})
	}

	open() {
		if (this.opened)
			return new Promise<void>(res => res());
		return new Promise<void>((res, rej) => {
			this.openprom = res;
			this.openrej = rej;
		});
	}

	async start() {
		this.clear();
		if (this.usable) {
			return new Promise<void>(e => e());
		}
		try {
			await this.open();

			// don't care yet
			let user = await this.read('updateuser');
			let formats = await this.read('formats');
			// Hum what the fuck zarle?
			// let rooms = await this.read('queryresponse');
			let challstr = await this.read('challstr');
			challstr.shift();
			this.challstrraw = challstr.join('|');
			this.usable = true;
			// heartbeat
			this.iid = setInterval(() => this.send('/me dabs'), 1000 * 60);
			if (!this.ws)
				throw 'Socket not initialized';
			this.ws.onclose = async (ev) => {
				let bp = this.ws!.onclose;
				this.ws!.onclose && this.ws!.onclose();
				this.close();
				await this.start();
				this.ws!.onclose = bp;
			};
			this.onstart && await this.onstart();
		} catch (e) {
			console.log('Something horribly wrong happened, disabled websocket', e);
			if (this.proxy) {
				await findProxyDogarsChan();
				return;
			}
			this.close();
			await this.start();
		}
	}
};

let connection: Player;

// Guest
// connection = new PSConnection();

// Named
export let findProxyDogarsChan = async () => {
	let success = false;
	if (!settings.proxy) {
		connection = new Player(settings.showdown.user, settings.showdown.pass);
		return;
	}
	do {
		try {
			let pr = await nextWorkingProxy(false);
			connection = new Player(settings.showdown.user, settings.showdown.pass, pr);
			await connection.connect();
			console.log('Successfull connection with proxy ', pr);
			success = true;
		} catch (e) {
			await nextWorkingProxy(true); // prune proxy
		}
	}
	while (!success);
};

export { connection };
