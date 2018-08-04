import BasicHandler from "./BasicHandler";
import { BattleMonitor } from "../BattleMonitor";
import { snooze } from "../../Website/utils";

export default class EndHandler extends BasicHandler {
    bm!: BattleMonitor;
    async attached(bm: BattleMonitor, detach: () => void) {
        super.attached(bm, detach);
        this.bm = bm;
    }

    async win() {
        await snooze(15000);
        this.account.tryLeave(this.roomname);
        this.bm.listeners = [];
    }
}