import { PSRoom, RoomID } from './PSRoom';
import { Player } from './Player';
import { BattleEvents, BattleEventsName } from './PSMessage';
import { BattleURL } from '../Backend/CringeCompilation';

export type BattleHandler = {
	[key in BattleEventsName]?: (m: BattleEvents[key]) => Promise<void>
} & {
	attached(bm: BattleMonitor, detach: () => void): void;
};

export class BattleMonitor {
	room: PSRoom;
	account: Player;
	listeners: BattleHandler[] = [];
	url: BattleURL;

	constructor(acc: Player, link: BattleURL) {
		this.url = link;
		this.account = acc;
		this.room = this.account.tryJoin(link.match(/(battle-.*)\/?/)![0] as RoomID);
	}

	attachListener(bl: BattleHandler) {
		this.listeners.push(bl);
		bl.attached(this, () => {
			this.listeners.splice(this.listeners.indexOf(bl), 1);
		})
	}

	attachListeners(bl: BattleHandler[]) {
		bl.forEach(this.attachListener.bind(this));
	}

	async monitor() {
		console.log('Started monitoring', this.room.room);
		while (this.listeners.length != 0) {
			let event = await this.room.read();
			this.listeners
				.map(l => l[event[0]] && l[event[0]]!.bind(l))
				.filter(f => f)
				.forEach(f => f!(event as any));
		}
	}
}
