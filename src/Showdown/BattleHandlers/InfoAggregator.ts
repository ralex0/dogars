import BasicHandler from "./BasicHandler";
import { Champ } from "../../Shoedrip/Champ";
import { BattleData, playerAlias } from "../BattleData";
import { levenshtein, toId } from "../../Website/utils";
import { isRegged } from "../PlayerHijack";
import { BattleEvents } from "../PSMessage";
import { registerChampResult } from "../../Backend/mongo";
import { RoomID } from "../PSRoom";

export default class InfoAggregator extends BasicHandler {
    battlers: Map<playerAlias, Champ> = new Map<playerAlias, Champ>();
    battleData: BattleData;
    guessedChamp: Champ;

    constructor(info: Champ) {
        super();
        this.guessedChamp = info;
        this.battleData = new BattleData(info);
        if (info.current_battle)
            this.battleData.roomid = info.current_battle.match(/battle-(.*)\/?/)![0] as RoomID;
    }

    async player(pl: BattleEvents['player']) {
        if (pl[1] != 'p1' && pl[1] != 'p2')
            return;
        let nc = new Champ();
        nc.showdown_name = pl[2];
        nc.avatar = pl[3];

        this.battlers.set(pl[1], nc);
        let dist = levenshtein(this.battleData.champ.name || '', pl[2]);
        if (dist < this.battleData.dist) {
            this.battleData.champ.showdown_name = pl[2];
            this.battleData.champ.avatar = pl[3];
            this.battleData.champ_alias = pl[1];
            this.battleData.dist = dist;
        }

        // when all battlers are known
        if (this.battlers.size == 2) {
            let names = [...this.battlers.entries()].map(ent => [ent[0], ent[1].showdown_name] as [playerAlias, string]);
            if (!this.guessedChamp.possible_names)
                return;
            this.guessedChamp.possible_names = this.guessedChamp.possible_names.filter(n => names[1].includes(n));
            if (this.guessedChamp.possible_names.length == 1) {
                let alias = names.find(n => n[1] === this.guessedChamp.possible_names[0])![0];
                let fc = this.battlers.get(alias);
                if (!fc)
                    return;
                this.battleData.champ.showdown_name = fc.showdown_name;
                this.battleData.champ.avatar = fc.avatar;
                this.battleData.champ_alias = alias;
                this.battleData.dist = 0;
            }
        }
    }

    async "switch"(sw: BattleEvents['switch']) {
        if (this.battleData.dist >= 3) {
            let name = sw[1].split(': ')[1].trim();
            let forme = sw[2].split(',')[0].split('-')[0].trim();
            if (forme != name) {
                this.battleData.dist = 0;
                this.battleData.champ_alias = sw[1].split(': ')[0].substr(0, 2) as ('p1' | 'p2');
                let battler = this.battlers.get(this.battleData.champ_alias);
                if (!battler)
                    return;
                this.battleData.champ.showdown_name = battler.showdown_name;
                this.battleData.champ.avatar = battler.avatar;
            }
        }
        if (!this.battleData.champ_alias)
            return;
        if (sw[1].indexOf(this.battleData.champ_alias) == 0) {
            let memename = sw[1].substr(5);
            this.battleData.active_meme = memename;
            let battler = this.battlers.get(this.battleData.champ_alias);
            if (!battler)
                return;
            let exists = battler.team.some(mon => mon.name == memename);
            if (!exists)
                battler.team.push({ name: memename, kills: 0, dead: false })
        }
    }

    async faint(fainted: BattleEvents['faint']) {
        if (!this.battleData.champ_alias)
            return;
        let battler = this.battlers.get(this.battleData.champ_alias);
        if (!battler)
            return;
        if (fainted[1].indexOf(this.battleData.champ_alias) == 0) {
            let memename = fainted[1].substr(5);
            for (let i = 0; i < battler.team.length; ++i)
                if (battler.team[i].name == memename)
                    battler.team[i].dead = true;
        } else {
            for (let i = 0; i < battler.team.length; ++i)
                if (battler.team[i].name == this.battleData.active_meme)
                    battler.team[i].kills++;
        }
    }

    async win(w: BattleEvents['win']) {
        super.win(w);
        if (!this.battleData.champ_alias)
            return;
        let champdata = this.battlers.get(this.battleData.champ_alias);
        if (champdata) {
            this.battleData.memes = champdata.team;
            if (champdata.showdown_name) {
                await registerChampResult(this.battleData, champdata.showdown_name == w[1]);
            }
        }
        this.battleData.finished = true;
        this.guessedChamp.possible_names = [...this.battlers.entries()].map(ent => ent[1].showdown_name);
    }
}