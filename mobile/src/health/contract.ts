import type { CardioRow, QuantitySampleIn, SleepRow, SleepSampleIn } from '../sync/mapping';

/**
 * What the sync needs from the phone's health store. iOS implements it with HealthKit (healthkit.ts, via provider.ts)
 * and Android with Health Connect (healthconnect.ts, via provider.android.ts). Metro picks the file for the platform, so
 * each build bundles only its own. Both files check themselves against this type, so they cannot drift apart.
 */
export interface HealthProvider {
  available(): boolean;
  askToRead(): Promise<boolean>;
  readSleep(from: Date): Promise<SleepSampleIn[]>;
  readHrv(from: Date): Promise<QuantitySampleIn[]>;
  readRestingHr(from: Date): Promise<QuantitySampleIn[]>;
}

/** The values the sync writes into source columns, so a night or a day always says where it came from. */
export interface ProviderIdentity {
  sleepSourceKind: SleepRow['source_kind'];
  cardioSource: CardioRow['source'];
}
