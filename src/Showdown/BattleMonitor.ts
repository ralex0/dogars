import { PSRoom } from './PSRoom';
import { Player } from './Player';
import { BattleEvents, BattleEventsName } from './PSMessage';

export type BattleHandler = {
	[key in BattleEventsName]?: (m: BattleEvents[key]) => Promise<void>
} & {
	attached(bm: BattleMonitor, detach: () => void): void;
};

export class BattleMonitor {
	room: PSRoom;
	account: Player;
	listeners: BattleHandler[] = [];
	public url: string;

	constructor(acc: Player, link: string) {
		this.url = link;
		this.account = acc;
		console.log(link);
		this.room = this.account.tryJoin(link.match(/(battle-.*)\/?/)![0]);
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
		while (this.listeners) {
			let event = await this.room.read();
			this.listeners
				.map(l => l[event[0]] && l[event[0]]!.bind(l))
				.filter(f => f)
				.forEach(f => f(event));
		}
	}
}
