import { MemeStats } from "../Showdown/BattleData";

export class Champ {
	avatar: string = '166';
	current_battle: string = '';
	name: string = '';
	trip: string = '';
	showdown_name: string = '';
	active: boolean = false;
	deaddrip: boolean = false;
	last_active: number = 0;
	jacked: boolean = false;
	team: MemeStats[] = [];
}