import { BattleMonitor } from '../Showdown/BattleMonitor';

import * as mongo from '../Backend/mongo';
import { Champ } from './Champ';

import { fchan } from '../Yotsuba/fchan';

import { snooze } from '../Website/utils';

export let champ: Champ = new Champ();

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
        let content = thread.posts![i].com!.replace(/<(?:.|\n)*?>/gm, '');
        let matches;
        if ((matches = content.match(/(https?:\/\/)?play.pokemonshowdown.com\/battle-(.*)-([0-9]*)/g))) {
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
            champ.current_battle = matches[0];
            if (champ.current_battle[0] != 'h')
                champ.current_battle = 'https://' + champ.current_battle;
            return champ;
        }
    }
    return champ;
}

let oldbattle: string = '';

function timeOutPromise<T>(prom: Promise<T>, timeout: number): Promise<T> {
    return Promise.race([prom, new Promise<T>((res, rej) => setTimeout(rej, timeout, 'Timed out'))]);
}

export let shoestart = async () => {
    while (true) {
        try {
            let thread = await timeOutPromise(getCurrentThread(), 30000);
            champ = await timeOutPromise(getCurrentChamp(thread), 30000);

            if (champ.current_battle != oldbattle && champ.active) {
                oldbattle = champ.current_battle;
                let bm = new BattleMonitor(champ, !!champ.name);
                bm.monitor();
            }
            if (champ.active) {
                let dbchamp = await mongo.ChampsCollection.findOne({ trip: champ.trip });
                champ.avatar = '166';
                if (dbchamp) {
                    champ.avatar = dbchamp.avatar!;
                }
            }
        }
        catch (e) {
            console.log(e);
        }
        await snooze(1000 * 60);
    }
}
