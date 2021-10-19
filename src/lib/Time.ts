import { extractUnit } from "lib";

class TimeError extends Error {
    readonly name = TimeError.name;
}

export class Time {
    private _s: number;

    constructor(s: string) {
        this._s = this._standarlize(s);
    }

    private _standarlize(s: string): number {
        const unit = extractUnit(s);
        if (!unit) throw new TimeError(`No time unit found`);
        switch (unit) {
            case `s`:
                return parseFloat(s);
            case `ms`:
                return parseFloat(s) / 1000;
            case `µs`:
                return parseFloat(s) / 1000000;
            default:
                throw new TimeError(`Time unit not regconized`);
        }
    }

    public toSecond(): number {
        return this._s;
    }

    public plus(s: Time | string): Time {
        if (typeof s === `string`) this._s += this._standarlize(s);
        else this._s += s.toSecond();
        return this;
    }

    public divide(n: number): Time {
        this._s /= n;
        return this;
    }

    public toString(): string {
        let n = this._s;
        for (const unit of [`s`, `ms`]) {
            if (n > 0) return `${n} ${unit}`;
            else n = n * 1000;
        }
        return `${n} µs`;
    }
}
