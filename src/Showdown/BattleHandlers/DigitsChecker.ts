import { BattleMonitor } from "../BattleMonitor";
import BasicHandler from "./BasicHandler";

export default class DigitsChecker extends BasicHandler {
    async attached(bm: BattleMonitor, detach: () => void) {
        super.attached(bm, detach);        
		let str = this.roomname;
		let l = str.length - 1;
		let d = str[l];
		while (str[l] == d)
			--l;
		let n = str.length - l - 1;		
		if (n >= 2) {
			let mess = [
				'checked',
				'nice trips',
				'nice quads!',
				'holy quints!'
			][n - 2];
			if (!mess)
				mess = 'DIGITS CHECKED';
			this.account.message(this.roomname, mess);
		}
    }
}
