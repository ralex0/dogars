import { BattleMonitor } from '../Showdown/BattleMonitor';

import * as mongo from '../Backend/mongo';
import { Champ } from './Champ';

import { fchan } from '../Yotsuba/fchan';

import { snooze } from '../Website/utils';
import { connection } from '../Showdown/PSConnection';
import CringeHandler from '../Showdown/BattleHandlers/CringeHandler';
import DigitsChecker from '../Showdown/BattleHandlers/DigitsChecker';
import EndHandler from '../Showdown/BattleHandlers/EndHandler';
import GreetingHandler from '../Showdown/BattleHandlers/GreetingHandler';
import HijackHandler from '../Showdown/BattleHandlers/HijackHandler';
import InfoAggregator from '../Showdown/BattleHandlers/InfoAggregator';
import Announcer from '../Showdown/BattleHandlers/Announcer';
import { BattleURL } from '../Backend/CringeCompilation';
import { BattleAvatarNumbers } from './dexdata';

export let champ: Champ = new Champ();
export let cthread: { no?: number, tim?: number } = {};

let getCurrentThread = async () => {
    let catalog = await fchan.getBoard('vp');
    let derp_no = 0;
    let derp: fchan.OP = new fchan.OP({});
    let found = false;
    catalog.forEach(page => {
        page.threads!.forEach(t => {
            if ((t.com && t.com.toLowerCase().indexOf('dogars.ml') != -1 ||
                t.sub && t.sub.toLowerCase().indexOf('showderp') != -1) &&
                t.no > derp_no) {
                derp = t;
                derp_no = Math.max(t.no, derp_no);
                found = true;
            }
        });
    });
    if (!found)
        throw new Error("Couldn't find a suitable thread");
    return derp.getThread();
}

let getCurrentChamp = async (thread: fchan.Thread) => {
    let derp_no = 0;
    let champ = <Champ>{
        avatar: '166',
    };
    for (let i = thread.posts!.length - 1; i != 0; --i) {
        if (!thread.posts![i].trip)
            continue;
        if (!thread.posts![i].com)
            continue;
        let content = thread.posts![i].com!
            .replace(/<(?:.|\n)*?>/gm, '')
            .replace(/<wbr>/gm, '');
        let matches;
        if ((matches = content.match(/(https?:\/\/)?play.pokemonshowdown.com\/battle-(.*)-([0-9]+)/g))) {
            let curtime = ~~(+new Date() / 1000);
            champ = <Champ>{
                name: thread.posts![i].name,
                trip: thread.posts![i].trip,
                last_active: thread.posts![i].time,
                avatar: '166'
            };
            champ.active = curtime - champ.last_active < 15 * 60;
			/*
			  Dead hours
			 */
            champ.deaddrip = curtime - champ.last_active < 120 * 60;
            champ.current_battle = matches[0] as BattleURL;
            if (champ.current_battle[0] != 'h')
                champ.current_battle = `https://${champ.current_battle}` as BattleURL;
            return champ;
        }
    }
    return champ;
}

let oldid: number = 0;

function timeOutPromise<T>(prom: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([prom, new Promise<T>((res, rej) => setTimeout(rej, timeout, 'Timed out'))]);
}

export let monitorPlayer = (champ: Champ) => {
    if (!champ.current_battle)
        return;
    let id = +champ.current_battle.split('-').pop()!;
    if (oldid && id <= oldid)
        return;
    oldid = id;
    let bm = new BattleMonitor(connection, champ.current_battle);
    let ia = new InfoAggregator(champ);
    bm.attachListeners([
        new Announcer(ia),
        new CringeHandler,
        new DigitsChecker,
        new GreetingHandler,
        ia,
        //new HijackHandler(ia),
        new EndHandler(ia)
    ]);
    bm.monitor();
}

export let shoestart = async () => {
    while (true) {
        try {
            let thread = await timeOutPromise(getCurrentThread(), 30000);
            champ = await timeOutPromise(getCurrentChamp(thread), 30000);
            cthread = { no: thread.id, tim: thread.posts![0].tim! };
            if (champ.active) {
                monitorPlayer(champ);
            }
            if (champ.active) {
                let dbchamp = await mongo.ChampsCollection.findOne({ trip: champ.trip });
                champ.avatar = '166';
                if (dbchamp) {
                    champ.avatar = dbchamp.avatar!;
                }
                if (champ.avatar in BattleAvatarNumbers)
                    champ.avatar = BattleAvatarNumbers[champ.avatar as keyof typeof BattleAvatarNumbers];
            }
        }
        catch (e) {
            console.log(e);
        }
        await snooze(1000 * 60);
    }
}
