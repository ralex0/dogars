import { Player } from './Showdown/Player';
import { BattleMonitor } from './Showdown/BattleMonitor';
import InfoAggregator from './Showdown/BattleHandlers/InfoAggregator';
import Announcer from './Showdown/BattleHandlers/Announcer';
import CringeHandler from './Showdown/BattleHandlers/CringeHandler';
import DigitsChecker from './Showdown/BattleHandlers/DigitsChecker';
import GreetingHandler from './Showdown/BattleHandlers/GreetingHandler';
import HijackHandler from './Showdown/BattleHandlers/HijackHandler';
import EndHandler from './Showdown/BattleHandlers/EndHandler';
import { DogarsClient, IPCCmd } from './DogarsClient';
import { Champ } from './Shoedrip/Champ';

console.log('Starting dogars-chan...');

export let monitor = (champ: Champ, account: Player) => {
    console.log('Start monitor')
    let bm = new BattleMonitor(account, champ.current_battle!);
    let ia = new InfoAggregator(champ);
    bm.attachListeners([
        new Announcer(ia),
        new CringeHandler,
        new DigitsChecker,
        new GreetingHandler,
        ia,
        new HijackHandler(ia),
        new EndHandler(ia)
    ]);
    bm.monitor();
}

(async () => {
    await DogarsClient.connect();

    let ransuff = (n: number) => [...new Array(n)].map(e => '' + ~~(Math.random() * 10)).join('');

    let dogarschan = new Player('dogars-chan' + ransuff(3));
    await dogarschan.connect();
    console.log('Connected')
    monitor(await DogarsClient.refresh(), dogarschan);
    for await (let cmd of DogarsClient.messageStream()) {
        console.log(cmd);
        if (cmd.command == 'monitor') {
            monitor(cmd.champ, dogarschan);
        }
    }

})();