import BasicHandler from "./BasicHandler";
import { BattleEvents } from "../PSMessage";
import InfoAggregator from "./InfoAggregator";

const pebbles = ['aggressive aggregate', 'astucious asphalt',
    'buried boulders',
    'charizard chipper', 'concealed cobblestone',
    'deceiving deposit', 'disguised debris',
    'elusive elements',
    'furtive flint',
    'guileful granite',
    'hidden hornfels',
    'insidious iridium', 'inconceivable iron',
    'keen kryptonite',
    'latent lead', 'lurking limestone',
    'merciless minerals', 'metaphorical moth balls',
    'ninja nuggets',
    'obscure ore',
    'pernicious pebbles',
    'rusing radium', 'reclusive rocks',
    'sacrilegious shards', 'shrouded sediment', 'smogon stones',
    'terrorizing tectinics', 'tricky terrain',
    'veiled variolite',
    'zetetic zircon'
];

let shuffle = <T>(arr: Array<T>) => {
    let currentIndex = arr.length, temporaryValue, randomIndex;
    while (currentIndex != 0) {
      randomIndex = ~~(Math.random() * currentIndex--);
      temporaryValue = arr[currentIndex];
      arr[currentIndex] = arr[randomIndex];
      arr[randomIndex] = temporaryValue;
    }
    return arr;
}

export default class Announcer extends BasicHandler {
    private warned: boolean = false;
    ia: InfoAggregator;
    pebbles: string[];

    constructor(ia: InfoAggregator) {
        super();
        this.ia = ia;
        this.pebbles = shuffle(pebbles.slice());
    }

    nummons: { p1: number, p2: number } = { p1: 0, p2: 0 };
    async teamsize(ts: BattleEvents['teamsize']) {
        let s: number = +ts[2];
        if (s < 6) {
            this.account.message(this.roomname, `psh,., i only need ${s},,.kid... nothin personel,,..,`);
        }
        this.nummons[ts[1] as 'p1' | 'p2'] = s;
    }

    async inactive(i: BattleEvents['inactive']) {
        if (this.warned)
            return;
        if (i[1].includes(this.ia.guessedChamp.showdown_name))
            return;
        this.warned = true;
        this.account.message(this.roomname, `wtf turn that off`);
    }

    async cant(c: BattleEvents['cant']) {
        if (c[2] == 'flinch' || c[2] == 'par') {
            if (c[2] == 'flinch' && this.turnFlags['fotarget'] && this.turnFlags['fotarget'] == c[1])
                return;
            this.account.message(this.roomname, `nice skill`);
        }
    }

    async move(m: BattleEvents['move']) {
        if (m[3].includes('hoge') && m[4] && m[4] == '[miss]') {
            this.account.message(this.roomname, `HOGE! HOGE! H O G E!`);
        } else if (m[2] == 'Scald') {
            this.turnFlags['scalder'] = m[1];
        } else if (m[2] == 'Fake Out') {
            this.turnFlags['fotarget'] = m[3];
        } else if (m[2] == 'Stealth Rock') {
            if (this.pebbles.length == 0)
                this.pebbles = shuffle(pebbles.slice())                
            let p = this.pebbles.splice(this.pebbles.length - 1, 1)[0];
            this.account.message(this.roomname, p);
        }
    }

    async "-status"(s: BattleEvents['-status']) {
        if (s[2] == 'brn' && this.turnFlags['scalder'] && this.turnFlags['scalder'] != s[1]) {
            if (s[3] !== undefined && s[3]!.includes('[from] item'))
                return;
            this.account.message(this.roomname, `le hot water of skill claims another`);
        }
    }

    turnFlags: any = {};
    async turn(t: BattleEvents['turn']) {
        this.turnFlags = {};
    }

    async "-crit"(c: BattleEvents['-crit']) {
        this.turnFlags['critted'] = c[1];
    }

    async "faint"(c: BattleEvents['faint']) {
        if (this.turnFlags['critted'] == c[1]) {
            this.account.message(this.roomname, 'crit mattered');
        }
        let pl = c[1].substr(0, 2) as 'p1' | 'p2';
        this.nummons[pl]--;
    }

    async win(w: BattleEvents['win']) {
        let diff = this.nummons.p1 - this.nummons.p2;
        diff = diff < 0 ? -diff : diff;
        let mes = [
            'wtf',
            'that was close',
            'bg',
            'bg',
            'bg',
            'no 6-0 bg',
            '6-0 bg hacker'
        ];
        this.account.message(this.roomname, mes[diff]);
    }
}
