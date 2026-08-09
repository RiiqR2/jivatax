const SCALE = 4;
const FACTOR = 10n ** BigInt(SCALE);

/** Exact fixed-scale monetary arithmetic. It deliberately never passes through JS number. */
export class FixedDecimal {
  private constructor(private readonly units: bigint) {}

  static parse(value: string): FixedDecimal {
    if (!/^-?\d+(\.\d{1,4})?$/.test(value))
      throw new Error(`Invalid monetary decimal: ${value}`);
    const negative = value.startsWith("-");
    const [integer, fraction = ""] = value.replace("-", "").split(".");
    const units =
      BigInt(integer) * FACTOR + BigInt(fraction.padEnd(SCALE, "0"));
    return new FixedDecimal(negative ? -units : units);
  }
  static zero(): FixedDecimal {
    return new FixedDecimal(0n);
  }
  add(other: FixedDecimal): FixedDecimal {
    return new FixedDecimal(this.units + other.units);
  }
  subtract(other: FixedDecimal): FixedDecimal {
    return new FixedDecimal(this.units - other.units);
  }
  abs(): FixedDecimal {
    return new FixedDecimal(this.units < 0n ? -this.units : this.units);
  }
  isZero(): boolean {
    return this.units === 0n;
  }
  greaterThan(other: FixedDecimal): boolean {
    return this.units > other.units;
  }
  toString(): string {
    const negative = this.units < 0n;
    const absolute = negative ? -this.units : this.units;
    return `${negative ? "-" : ""}${absolute / FACTOR}.${(absolute % FACTOR).toString().padStart(SCALE, "0")}`;
  }
}
