import { createServer } from "http";

import { Champ } from "./Shoedrip/Champ";

import { BattleMonitor } from "./Showdown/BattleMonitor";
import { connection } from "./Showdown/PSConnection";

import { Cringer } from "./Backend/CringeProvider";

let tests = createServer((r, re) => {});
Cringer.install(tests);
tests.listen(1531, async () => {
    await connection.connect();
    let bdev = new Champ();
    bdev.name = 'bored dev';
    bdev.showdown_name = 'bored dev';
    bdev.trip = 'who cares';
    bdev.current_battle = 'https://play.pokemonshowdown.com/battle-gen7randombattle-770131763';
    let bm = new BattleMonitor(bdev);
    await bm.monitor();
});
