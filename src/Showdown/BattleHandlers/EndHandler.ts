import BasicHandler from "./BasicHandler";
import { BattleMonitor } from "../BattleMonitor";
import { snooze } from "../../Website/utils";
import { PSUserDetails, UserDetails } from "../PSMessage";
import InfoAggregator from "./InfoAggregator";
import { monitorPlayer, champ } from "../../Shoedrip/shoedrip";

export default class EndHandler extends BasicHandler {
    bm!: BattleMonitor;
    ia: InfoAggregator;
    async attached(bm: BattleMonitor, detach: () => void) {
        super.attached(bm, detach);
        this.bm = bm;
    }

    constructor(ia: InfoAggregator) {
        super();
        this.ia = ia;
    }

    async win() {
        if (this.ia.battleData.dist == 0)
            for (let i = 0; i < 45; ++i) {
                let data: UserDetails = await this.account.request(new PSUserDetails(this.ia.guessedChamp.showdown_name))
                if (data.rooms === false)
                    break;
                let rooms = Object.keys(data.rooms)
                    .filter(n => n.includes('☆')) // do not follow rooms
                    .map(n => n.substr(1)) // remove the star
                    .filter(n => n > this.roomname); // newest rooms
                if (rooms.length >= 1) {
                    this.ia.guessedChamp.current_battle = `https://play.pokemonshowdown.com/${rooms[0]}`
                    monitorPlayer(this.ia.guessedChamp);
                    break;
                }
                await snooze(1000);
            }
        else {
            console.log(`Didn't follow champ because`, this.ia.battleData, champ);
        }
        this.account.tryLeave(this.roomname);
        this.bm.listeners = [];
    }
}