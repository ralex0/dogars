import { BattleMonitor, BattleHandler } from "../BattleMonitor";
import { BattleEvents } from "../PSMessage";
import { Player } from "../Player";

export default class BasicHandler implements BattleHandler {
    protected account!: Player;
    protected roomname!: string;
    private detach?: () => void;

    async attached(bm: BattleMonitor, detach: () => void) {
        this.roomname = bm.room.room;
        this.account = bm.account;
        this.detach = detach;
    }

    async win(w: BattleEvents['win']) {
        this.detach && this.detach();
    }
}
