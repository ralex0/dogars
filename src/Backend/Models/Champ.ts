export class Champ {
    id!: number;
    constructor(name: string, trip: string) {
        this.name = name;
        this.trip = trip;
    }

    name!: string;
    trip!: string;
    wins!: number;
    loses!: number;
    avatar?: string;
    elo!: number;
    showdown_name!: string;
}
