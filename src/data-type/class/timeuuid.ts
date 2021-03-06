import * as cassandra from "cassandra-driver";
import { DataTypeValueBase } from "../base/data-type";

export class TimeUuidDataTypeValue extends DataTypeValueBase<cassandra.types.TimeUuid> {
    public checkValid(value: string): boolean {
        return this.isUuid(value);
    }
    public parseValue(value: string) {
        const val = cassandra.types.TimeUuid.fromString(value);
        return val;
    }
    protected toString(value: cassandra.types.Uuid): string {
        return `${value.toString()}`;
    }
    public get stringPlaceholder(): string {
        const tuuid = cassandra.types.TimeUuid.now();
        return `${tuuid.toString()}`;
    }
}
