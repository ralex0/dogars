import * as puppeteer from "puppeteer";
import fs = require('fs');
import { settings } from "./settings";
import { Cringer } from "./CringeProvider";
import { As } from "../Showdown/PSMessage";

export type BattleURL = string & As<'BattleURL'>;


let browser: puppeteer.Browser | null = null;
let getBrowser = async () => {
    if (browser)
        return browser;
    return browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium', args: ['--no-sandbox'] });
}

export class CringCompilation {
    battleLink: BattleURL;
    inited: boolean = false;
    browser?: puppeteer.Browser;
    page?: puppeteer.Page;
    constructor(battleLink: BattleURL) {
        this.battleLink = battleLink;
    }

    async init() {
        this.browser = await getBrowser();
        this.page = await this.browser.newPage();
        this.page.setViewport({ width: 831, height: 531 });

        await this.page.goto(this.battleLink);
        let lll: any = {
            "dark": false,
            "bwgfx": false,
            "noanim": false,
            "nopastgens": true
        };
        lll = JSON.stringify(lll);
        await this.page.evaluate(`localStorage.setItem("showdown_prefs", '${lll}');`);
        this.inited = true;
    }

    async snap() {
        if (!this.inited)
            await this.init();
        let buff = await this.page!.screenshot({
            type: 'png'
        });
        let cringefolder = `${settings.ressources}/public/cringec`;
        if (!fs.existsSync(cringefolder))
            fs.mkdirSync(cringefolder);
        let tmp = `${cringefolder}/tmp.png`;
        fs.writeFileSync(tmp, buff);
        let len = fs.readdirSync(cringefolder).length;
        let newfile = `${cringefolder}/${len}.png`
        fs.renameSync(tmp, newfile);
        Cringer.pushNewCringe(len);
    }

    async cleanup() {
        if (this.page)
            await this.page!.close();
    }
}
