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
    battleData: BattleData = new BattleData();
    guessedChamp: Champ;

    constructor(info: Champ) {
        super();
        this.guessedChamp = info;
        this.battleData.champ = info;
        if (info.current_battle)
            this.battleData.roomid = info.current_battle.match(/battle-(.*)\/?/)![0] as RoomID;
    }

    async player(pl: BattleEvents['player']) {
        if (pl[1] != 'p1' && pl[1] != 'p2')
            return;
        let nc = new Champ();
        nc.showdown_name = pl[2];
        nc.avatar = pl[3];

        this.battlers.set(pl[1]!, nc);
        let dist = levenshtein(this.battleData.champ!.name || '', pl[2]);
        if (dist < this.battleData.dist!) {
            this.battleData.champ!.showdown_name = pl[2];
            this.battleData.champ!.avatar = pl[3];
            this.battleData.champ_alias = pl[1];
            this.battleData.dist = dist;
        }

        // when all battlers are known
        if (this.battlers.size == 2) {
            let names = (<playerAlias[]>['p1', 'p2']).map(x => [x, this.battlers.get(x)!.showdown_name] as [playerAlias, string]);
            if (!this.guessedChamp.possible_names)
                return;
            this.guessedChamp.possible_names = this.guessedChamp.possible_names.filter(n => names[1].includes(n));
            if (this.guessedChamp.possible_names.length == 1) {
                let alias = names.find(n => n[1] === this.guessedChamp.possible_names[0])![0];
                let fc = this.battlers.get(alias)!;
                this.battleData.champ!.showdown_name = fc.showdown_name;
                this.battleData.champ!.avatar = fc.avatar;
                this.battleData.champ_alias = alias;
                this.battleData.dist = 0;
            }
        }
    }

    async "switch"(sw: BattleEvents['switch']) {
        if (this.battleData.dist! >= 3) {
            let name = sw[1].split(': ')[1].trim();
            let forme = sw[2].split(',')[0].split('-')[0].trim();
            if (forme != name) {
                this.battleData.dist = 0;
                this.battleData.champ_alias = sw[1].split(': ')[0].substr(0, 2) as ('p1' | 'p2');
                this.battleData.champ!.showdown_name = this.battlers.get(this.battleData.champ_alias!)!.showdown_name;
                this.battleData.champ!.avatar = this.battlers.get(this.battleData.champ_alias!)!.avatar;
            }
        }
        if (sw[1].indexOf(this.battleData.champ_alias!) == 0) {
            let memename = sw[1].substr(5);
            this.battleData.active_meme = memename;
            let exists = this.battlers.get(this.battleData.champ_alias!)!.team.some(mon => mon.name == memename);
            if (!exists)
                this.battlers.get(this.battleData.champ_alias!)!.team.push({ name: memename, kills: 0, dead: false })
        }
    }

    async faint(fainted: BattleEvents['faint']) {
        if (fainted[1].indexOf(this.battleData.champ_alias!) == 0) {
            let memename = fainted[1].substr(5);
            for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
                if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == memename)
                    this.battlers.get(this.battleData.champ_alias!)!.team[i].dead = true;
        } else {
            for (let i = 0; i < this.battlers.get(this.battleData.champ_alias!)!.team.length; ++i)
                if (this.battlers.get(this.battleData.champ_alias!)!.team[i].name == this.battleData.active_meme)
                    this.battlers.get(this.battleData.champ_alias!)!.team[i].kills++;
        }
    }

    async win(winner: BattleEvents['win']) {
        let champdata = this.battlers.get(this.battleData.champ_alias!);
        if (champdata) {
            this.battleData.memes = champdata.team!;
            if (champdata.showdown_name) {
                await registerChampResult(this.battleData, champdata.showdown_name == winner[1]);
            }
        }
        this.battleData.finished = true;
        this.guessedChamp.possible_names = ['p1', 'p2'].map(x => this.battlers.get(x as playerAlias)!.showdown_name);
    }
}