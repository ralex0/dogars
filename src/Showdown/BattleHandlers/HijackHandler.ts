import BasicHandler from "./BasicHandler";
import { BattleMonitor } from "../BattleMonitor";
import { PlayerHijack } from "../PlayerHijack";
import InfoAggregator from "./InfoAggregator";
import { playerAlias } from "../BattleData";
import { BattleEvents } from "../PSMessage";

export default class HijackHandler extends BasicHandler {
    ia!: InfoAggregator;
    attemptedJack: boolean = false;

    constructor(ia: InfoAggregator) {
        super();
        this.ia = ia;
    }

	async l(left: BattleEvents['l']) {
		let bool = (this.ia.battlers.get('p1')!.showdown_name == this.ia.battleData!.champ.showdown_name);
		let oppo_alias: playerAlias = bool ? 'p2' : 'p1';
		if (this.ia.battlers.get(oppo_alias)!.jacked)
			return;
		let oppo = this.ia.battlers.get(oppo_alias)!;
		let oppo_name = oppo!.showdown_name!;
		if (left[1].indexOf(oppo_name) == 0 || left[1].indexOf(oppo_name) == 1) {
			if (this.attemptedJack)
				return;
			this.attemptedJack = true;
			let hj = new PlayerHijack(this.ia.battleData!, this.ia.battlers);
			hj.tryJack(oppo.regged);
		}
	}

}
