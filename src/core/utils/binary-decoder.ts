export interface NormalizedOrder {
  price: number;
  amount: number;
  raw: [string, string];
}

export interface DecodedData {
  type: 'DEPTH_UPDATE';
  timestamp: number;
  sequence: number;
  bids: NormalizedOrder[];
  asks: NormalizedOrder[];
  meta: { packetId: number };
}

export interface RawBinanceData {
  u: number;
  b: [string, string][];
  a: [string, string][];
}

export class BinaryDecoder {
  private processedCount = 0;

  constructor() {
    this.processedCount = 0;
  }

  decode(rawData: RawBinanceData): DecodedData {
    this.processedCount++;

    if (!rawData) throw new Error('Empty buffer');

    return {
      type: 'DEPTH_UPDATE',
      timestamp: Date.now(),
      sequence: rawData.u,
      bids: this._normalizeList(rawData.b),
      asks: this._normalizeList(rawData.a),
      meta: { packetId: this.processedCount },
    };
  }

  private _normalizeList(list: [string, string][]): NormalizedOrder[] {
    return list.map((item) => ({
      price: parseFloat(item[0]),
      amount: parseFloat(item[1]),
      raw: item,
    }));
  }
}
