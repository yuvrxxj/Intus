// Android: Health Connect. The iPhone build uses provider.ts and never loads this file or react-native-health-connect.
import * as healthconnect from '../healthconnect';
import type { HealthProvider, ProviderIdentity } from './contract';

healthconnect satisfies HealthProvider;

export const { available, askToRead, readSleep, readHrv, readRestingHr } = healthconnect;

export const identity: ProviderIdentity = { sleepSourceKind: 'health_connect', cardioSource: 'health_connect' };
