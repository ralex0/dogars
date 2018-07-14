import * as SockJS from 'sockjs-client';

import { eventToPSMessages, PSMessage, Challstr, eventToPSBattleMessage, PSRequest, PSRoomRequest, QueryResponse, Formats, UpdateUser } from './PSMessage';
import { PSRoom } from './PSRoom';
import { Player } from './Player';

import { match } from '../Website/utils';

import { logger } from '../Backend/logger';
import { settings } from '../Backend/settings';

export class PSConnection {
	usable: boolean = false;
	ws?: WebSocket;
	wscache: string[] = [];
	iid?: NodeJS.Timer;
	challstrraw: string = '';
	eventqueue: PSMessage[] = [];
	rooms: Map<string, PSRoom> = new Map<string, PSRoom>();
	messagequeue: MessageEvent[] = [];
	openprom?: () => void;
	openrej?: () => void;
	opened = false;
	readprom?: { filter: any, res: (ev: PSMessage) => void };
	requests: ({ req: PSRequest<any>; res: (value?: any) => void; })[] = [];
	roomrequests: ({ req: PSRoomRequest<any>; res: (value?: any) => void; })[] = [];

	clear() {
		this.iid && clearTimeout(this.iid);
		this.usable = false;
		this.opened = false;
		this.ws && this.ws.close();
		this.ws = new SockJS('https://sim2.psim.us/showdown');
		this.ws.onmessage = ev => {
			if (ev.data[0] == '>') {
				let { room, events } = eventToPSBattleMessage(ev);
				this.roomrequests = this.roomrequests.filter(r => {
					let handled = false;
					events = events.filter(e => {
						if (r.req.room == room && r.req.isResponse(e)) {
							handled = true;
							r.res(r.req.buildResponse(e));
						}
					});
					let remove = events.some(e => r.req.room == room && r.req.isResponse(e));
					return !handled;
				})
				if (this.rooms.has(room)) {
					if (events instanceof Array)
						events.forEach(e => this.rooms.get(room)!.recv(e));
					else
						this.rooms.get(room)!.recv(events);
				}
			} else {
				let mesgs = eventToPSMessages(ev);
				this.requests = this.requests.filter(r => {
					let handled = false;
					mesgs = mesgs.filter(e => {
						if (r.req.isResponse(e)) {
							handled = true;
							r.res(r.req.buildResponse(e));
						}
					});
					let remove = mesgs.some(e => r.req.isResponse(e));
					return !handled;
				});
				if (this.readprom && (this.readprom.filter === undefined || match(mesgs[0], this.readprom.filter))) {
					this.readprom.res(mesgs.shift()!);
					this.readprom = undefined;
				}
				this.eventqueue.push(...mesgs);
			}
		};
		this.ws.onopen = () => {
			this.opened = true;
			this.openprom && this.openprom();
			this.openrej = undefined;
		}

		this.ws.onclose = (e: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej();
		}

		this.ws.onerror = (e: Event) => {
			this.opened = false;
			this.usable = false;
			this.openrej && this.openrej();
		}
	}

	constructor() {
		//this.clear();
	}

	send(data: string | ArrayBufferLike | Blob | ArrayBufferView) {
		if (!this.ws)
			throw 'Attempted to send without initialized socket';
		this.ws.send(data);
	}

	joinRoom(room: string): PSRoom {
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

	read(filter?: any): Promise<PSMessage> {
		return new Promise<PSMessage>((res, rej) => {
			if (this.eventqueue.length >= 1) {
				let idx = this.eventqueue.findIndex(m => match(m, filter));
				return res(this.eventqueue.splice(idx, 1)[0]!);
			}
			this.readprom = { filter, res };
		});
	}

	close() {
		this.usable = false;
		this.opened = false;
		if (!this.ws)
			throw 'Attempted to close without initialized socket';
		this.ws.close();
	}

	request(req: PSRequest<any>): Promise<any> {
		return new Promise<any>((res, rej) => {
			this.send(req.toString());
			this.requests.push({ req, res });
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

			let user = await this.read({ event_name: 'updateuser' }) as UpdateUser;
			let formats = await this.read({
				event_name: 'formats'
			}) as Formats;
			let rooms = await this.read({
				event_name: 'queryresponse'
			}) as QueryResponse;
			// don't care yet
			this.challstrraw = (await this.read({ event_name: 'challstr' }) as Challstr).challstr;
			this.usable = true;

			// heartbeat
			this.iid = setInterval(() => this.send('/me dabs'), 1000 * 60);
			if (!this.ws)
				throw 'Socket not initialized';
			this.ws.addEventListener('close', async (ev) => {
				logger.log(0, 'Socket was closed', ev.code, ev.reason);
				this.close();
				await this.start();
			}, { once: true });
		} catch (e) {
			console.log('Something horribly wrong happened, disabled websocket', e);
			this.close();
			await this.start();
		}
	}
};

let connection: Player;

// Guest
// connection = new PSConnection();

// Named
connection = new Player(settings.showdown.user, settings.showdown.pass);
//connection.connect();

export { connection };
