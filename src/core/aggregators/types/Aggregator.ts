import { OutputUrl, Optional } from "./payload";
import { tracer } from "tracer";
import { uuid } from "lib";

export class AggregatorError extends Error {
    readonly name = AggregatorError.name;
}

type SimpleAggregator<P> = (p: P) => object;

export class Aggregator<P extends Partial<OutputUrl> & Optional> {
    constructor(
        private readonly _aggregator: SimpleAggregator<P> | Record<string, SimpleAggregator<P>>,
        private readonly _name?: string,
    ) {
        if (!this._name) {
            this._name =
                typeof this._aggregator === `function`
                    ? this._aggregator.name
                    : Object.keys(this._aggregator)[0];
            if (!this._name) this._name = `anonymous_aggregator`;
        }
    }

    public aggregate(payload: P): object {
        const { E: gE } = tracer.B({ name: `aggregator.aggregate ${uuid()}` });
        if (typeof this._aggregator === `function`) {
            const { E } = tracer.B({ name: `aggregator ${this._name} ${uuid()}` });
            const result = this._aggregator(payload);
            E();
            return result;
        }
        try {
            if (!payload.output_url && !payload.operation)
                throw new AggregatorError(
                    `${this._name} is composite but not enough information to infer its path`,
                );
            const path = [payload.output_url, payload.operation, payload.step]
                .filter((v) => (v != null && typeof v.toString === `function` ? true : false))
                .join(`/`);
            if (!this._aggregator[path])
                throw new AggregatorError(`Aggregator not found at ${path} in ${this._name}`);
            const { E } = tracer.B({ name: `aggregator ${this._name}/${path} ${uuid()}` });
            const result = this._aggregator[path](payload);
            E();
            return result;
        } finally {
            gE();
        }
    }
}
