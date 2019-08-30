import { BattleMonitor } from "../BattleMonitor";
import { CringeCompilation } from "../../Backend/CringeCompilation";
import BasicHandler from "./BasicHandler";
import { BattleEvents } from "../PSMessage";
import { DogarsClient } from "../../DogarsClient";

export default class CringeHandler extends BasicHandler {
    private compiler!: CringeCompilation;
    private ready: boolean = false;
    private filter: { [k: string]: number } = {};

    async attached(bm: BattleMonitor, detach: () => void) {
        super.attached(bm, detach);
        await DogarsClient.prepareCringe(bm.url);
        await this.compiler.init();
        this.ready = true;
    }

    async c(m: BattleEvents['c']) {
        if (!this.ready)
            return;
        if (m[1].includes('dogars'))
            return;
        let norm = m[2].toLowerCase();
        if (!(/\*sn(a|i)ps?\*/i).test(norm))
            return;
        let usertests = this.filter[m[1]] || 0;
        if (usertests >= 3)
            return;
        this.filter[m[1]] = usertests + 1;
        await DogarsClient.snap();
        this.account.message(this.roomname, "Yep. This one's going in my cringe compilation.");
    }

    async win() {
        await DogarsClient.closeCringe();
    }
}
