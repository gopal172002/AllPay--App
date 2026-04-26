import {Transaction} from '../types';

const wait = (ms: number) => new Promise<void>(resolve => setTimeout(resolve, ms));

export const syncTransactionToBackend = async (
  tx: Transaction,
): Promise<{ok: boolean; backendId: string}> => {
  await wait(1200);
  return {
    ok: true,
    backendId: `ALP-${tx.id}`,
  };
};
