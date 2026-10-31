// iPhone (and the default): Apple Health. Android gets provider.android.ts instead: Metro prefers the platform file.
import * as healthkit from '../healthkit';
import type { HealthProvider, ProviderIdentity } from './contract';

healthkit satisfies HealthProvider;

export const { available, askToRead, readSleep, readHrv, readRestingHr } = healthkit;

export const identity: ProviderIdentity = { sleepSourceKind: 'healthkit', cardioSource: 'healthkit' };
