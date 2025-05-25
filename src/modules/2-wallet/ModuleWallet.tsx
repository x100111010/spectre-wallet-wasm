import { FC } from 'react';

import { ModuleWalletStep1 } from './module-wallet-step-1';

export const ModuleWallet: FC = () => {
  return (
    <div className="h-full flex flex-row">
      <div className="py-8 md:py-16 flex justify-center items-center mx-auto">
        <div className="max-w-5xl markdown">
          <h2>Create Your Wallet</h2>

          <p>
            <strong>Security Notice:</strong> Your mnemonic phrase provides complete access to your wallet.
            Protect it carefully and never share it with others.
          </p>

          <p>
            After wallet creation, record your mnemonic phrase and store it in a secure location. This phrase
            is required for wallet recovery and import operations.
          </p>
          <div className="py-8">
            <ModuleWalletStep1 />
          </div>
        </div>
      </div>
    </div>
  );
};

export default ModuleWallet;
