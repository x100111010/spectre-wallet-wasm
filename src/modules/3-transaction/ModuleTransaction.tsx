import { FC } from 'react';
import { ModuleTransactionStep1 } from './module-transaction-step-1';

export const ModuleTransaction: FC = () => {
  return (
    <div className="h-full flex flex-row">
      <div className="py-8 md:py-16 flex justify-center items-center mx-auto">
        <div className="max-w-2xl markdown">
          <div className="py-8">
            <ModuleTransactionStep1 />
          </div>

          <p>
            The DAA score also helps determine if a UTXO is "mature enough" to be trusted. A mature UTXO has a
            DAA score at least 10 points higher than the latest integrated block. This is also known as having
            10 confirmations from the network. So, your UTXO is mature because it has at least 10
            confirmations.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ModuleTransaction;
