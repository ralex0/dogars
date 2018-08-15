import { Sets } from "./Sets";
import { BattleURL } from "../CringeCompilation";

export class Replay {

    constructor(link: string, description: string, champ: string, trip: string, manual: number) {
        this.link = link;
        this.description = description;
        this.manual = manual;
        this.champ = champ;
        this.trip = trip;
        this.date = new Date();
    }

    id!: number;
    link!: string;
    date!: Date;
    description!: string;
    champ!: string;
    trip!: string;
    manual!: number;
    sets!: Sets[];
}
