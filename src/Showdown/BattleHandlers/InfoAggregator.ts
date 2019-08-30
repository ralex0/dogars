import BasicHandler from "./BasicHandler";
import { Champ } from "../../Shoedrip/Champ";
import { BattleData, playerAlias } from "../BattleData";
import { levenshtein, toId } from "../../Website/utils";
import { isRegged } from "../PlayerHijack";
import { BattleEvents } from "../PSMessage";
import { registerChampResult, init } from "../../Backend/mongo";
import { RoomID } from "../PSRoom";
import { BattleAvatarNumbers } from "../../Shoedrip/dexdata";
import { DogarsClient } from "../../DogarsClient";

export default class InfoAggregator extends BasicHandler {
    battlers: { [k in 'p1' | 'p2']: Champ } = {
        p1: new Champ,
        p2: new Champ
    };
    battleData: BattleData;
    guessedChamp: Champ;

    constructor(info: Champ) {
        super();
        this.guessedChamp = info;
        this.battleData = new BattleData(info);
        if (info.current_battle)
            this.battleData.roomid = info.current_battle.match(/battle-(.*)\/?/)![0] as RoomID;
    }

    async poke(p: BattleEvents['poke']) {
        let battler = this.battlers[p[1]];
        let species = p[2].split(',')[0]; 
        battler.team.push({species, name: '', dead: false, kills: 0});
    }

    init = 0;
    async player(pl: BattleEvents['player']) {
        if (pl[1] != 'p1' && pl[1] != 'p2')
            return;
        ++this.init;
        this.battlers[pl[1]].showdown_name = pl[2];
        if (pl[3] in BattleAvatarNumbers)
            pl[3] = BattleAvatarNumbers[pl[3] as keyof typeof BattleAvatarNumbers];
        this.battlers[pl[1]].avatar = pl[3];

        let dist = levenshtein(this.battleData.champ.name || '', pl[2]);
        if (dist < this.battleData.dist) {
            this.battleData.champ.showdown_name = pl[2];
            this.battleData.champ.avatar = pl[3];
            this.battleData.champ_alias = pl[1];
            this.battleData.dist = dist;
        }

        // when all battlers are known
        if (this.init == 2) {
            let names: [playerAlias, string][] = [];
            for (let ent in this.battlers) {
                let al = ent as 'p1' | 'p2';
                names.push([al, this.battlers[al].showdown_name]);
            }
            if (!this.guessedChamp.possible_names)
                return;
            this.guessedChamp.possible_names = this.guessedChamp.possible_names.filter(n => names[1].includes(n));
            if (this.guessedChamp.possible_names.length == 1) {
                let alias = names.find(n => n[1] === this.guessedChamp.possible_names[0])![0];
                let fc = this.battlers[alias];
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
        if (this.battleData.dist >= 3) { // if still unsure about champs identity
            let name = sw[1].split(': ')[1].trim();
            let forme = sw[2].split(',')[0].split('-')[0].trim();
            if (forme != name) { // if it has a nickname then it's champ or a snowflake
                this.battleData.dist = 0;
                this.battleData.champ_alias = sw[1].split(': ')[0].substr(0, 2) as ('p1' | 'p2');
                let battler = this.battlers[this.battleData.champ_alias];
                if (!battler)
                    return;
                this.battleData.champ.showdown_name = battler.showdown_name;
                this.battleData.champ.avatar = battler.avatar;
            }
        }
        // Dont do anything more if champs identity isn't known
        if (!this.battleData.champ_alias)
            return;
        if (sw[1].indexOf(this.battleData.champ_alias) == 0) {
            let memename = sw[1].substr(5);
            this.battleData.active_meme = memename;
            let battler = this.battlers[this.battleData.champ_alias];
            if (!battler)
                return;
            let meme = battler.team.find(mon => mon.name == memename);
            let spec = sw[2].split(',')[0]!;
            if (!meme)
                battler.team.push({ species: spec, name: memename, kills: 0, dead: false })
            else if (!meme.kills) {
                meme.kills = 0;
                meme.dead = false;
                meme.name = memename;
                meme.species = spec
            }
        }
    }

    async faint(fainted: BattleEvents['faint']) {
        if (!this.battleData.champ_alias)
            return;
        let battler = this.battlers[this.battleData.champ_alias];
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
        let champdata = this.battlers[this.battleData.champ_alias];
        if (champdata) {
            this.battleData.memes = champdata.team;
            if (champdata.showdown_name) {
                await DogarsClient.registerChampResult(this.battleData, champdata.showdown_name == w[1]);
            }
        }
        this.battleData.finished = true;
        if (this.battleData.dist == 0)
            this.guessedChamp.possible_names = [this.battleData.champ.showdown_name];
        else
            this.guessedChamp.possible_names = Object.values(this.battlers).map(ent => ent.showdown_name);
    }
}