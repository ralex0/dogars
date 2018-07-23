import { Champ } from '../Shoedrip/Champ';

export class MemeStats {
	name: string = '';
	kills: number = 0;
	dead: boolean = false;
}

export class BattleData {
	champ!: Champ;
	dist: number = Infinity;
	roomid: string = '';
	finished: boolean = false;
	champ_alias?: 'p1' | 'p2';
	active_meme?: string;
	memes: MemeStats[] = []
}
