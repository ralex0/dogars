import { createServer } from "http";

import { Champ } from "./Shoedrip/Champ";

import { BattleMonitor } from "./Showdown/BattleMonitor";

import InfoAggregator from "./Showdown/BattleHandlers/InfoAggregator";
import Announcer from "./Showdown/BattleHandlers/Announcer";
import CringeHandler from "./Showdown/BattleHandlers/CringeHandler";
import DigitsChecker from "./Showdown/BattleHandlers/DigitsChecker";
import GreetingHandler from "./Showdown/BattleHandlers/GreetingHandler";
import HijackHandler from "./Showdown/BattleHandlers/HijackHandler";
import EndHandler from "./Showdown/BattleHandlers/EndHandler";
import { Player } from "./Showdown/Player";
import { connection } from "./Showdown/PSConnection";
import { BattleURL } from "./Backend/CringeCompilation";

let tests = createServer((r, re) => { });
//Cringer.install(tests);

tests.listen(1531, async () => {
    await connection.connect();
    let bdev = new Champ();
    bdev.name = 'bored dev';
    bdev.showdown_name = 'bored dev';
    bdev.trip = '!test';
    bdev.current_battle = 'https://play.pokemonshowdown.com/battle-gen7randombattle-794528583' as BattleURL;
    let bm = new BattleMonitor(connection, bdev.current_battle);
    let ia = new InfoAggregator(bdev);
    bm.attachListeners([
        new Announcer(ia),
        new CringeHandler,
        new DigitsChecker,
        new GreetingHandler,
        ia,
        //        new HijackHandler(ia),
        new EndHandler(ia)
    ]);
    await bm.monitor();
});
