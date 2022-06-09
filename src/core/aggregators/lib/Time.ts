class TimeError extends Error {
    readonly name = TimeError.name;
}

export class Time {
    private _ms: number;

    constructor(s: string) {
        this._ms = Time._standarlize(s);
    }

    private static _extractUnit(s: string) {
        return s.match(/[a-z]*$/)?.[0];
    }

    private static _standarlize(s: string): number {
        const unit = Time._extractUnit(s);
        if (!unit) throw new TimeError(`Time unit not found`);
        switch (unit) {
            case `s`:
                return parseFloat(s) * 1000;
            case `ms`:
                return parseFloat(s);
            case `µs`:
                return parseFloat(s) / 1000;
            default:
                throw new TimeError(`Time unit ${unit} not regconized`);
        }
    }

    public ms(): number {
        return this._ms;
    }

    public s(): number {
        return this._ms / 1000;
    }

    public plus(time: Time | string): Time {
        if (typeof time === `string`) this._ms += Time._standarlize(time);
        else this._ms += time.ms();
        return this;
    }

    public divide(n: number): Time {
        this._ms /= n;
        return this;
    }

    public toString(): string {
        let n = this.s();
        for (const unit of [`s`, `ms`]) {
            if (n > 0) return `${n} ${unit}`;
            else n = n * 1000;
        }
        return `${n} µs`;
    }
}
