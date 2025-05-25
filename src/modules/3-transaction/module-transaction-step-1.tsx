import { FC, useCallback, useEffect, useState } from 'react';
import { useSpectreStore } from '../../core/spectre-store';
import { useWalletStore } from '../../core/wallet-store';
import { sompiToSpectreString } from 'spectre-wasm';

type ModuleTransactionStep1Props = {};

export const ModuleTransactionStep1: FC<ModuleTransactionStep1Props> = ({}) => {
  const balance = useWalletStore((s) => s.balance);
  const address = useWalletStore((s) => s.address);

  const walletStore = useWalletStore();

  const unlockedWallet = useWalletStore((s) => s.unlockedWallet);

  const spectreClientInstance = useSpectreStore((s) => s.spectreClientInstance);
  const init = useSpectreStore((s) => s.init);

  const [step, setStep] = useState(0);

  const [firstUtxo, setFirstUtxo] = useState<
    | undefined
    | null
    | {
        amount: bigint;
        toAddress: string;
        blockDaaScore: bigint;
        transactionId: string;
      }
  >(undefined);

  const onNextStep = useCallback(async () => {
    setStep(step + 1);
  }, [step]);

  useEffect(() => {
    if (unlockedWallet && !address) {
      // Only if wallet is unlocked but not started
      const connectWallet = async () => {
        try {
          // Initialize the RPC client if needed
          if (!spectreClientInstance.connected) {
            await init();
          }

          // Start the wallet
          await walletStore.start(spectreClientInstance, unlockedWallet);
          console.log('Wallet started successfully');
        } catch (error) {
          console.error('Failed to start wallet:', error);
        }
      };

      connectWallet();
    }
  }, [unlockedWallet, address, spectreClientInstance, init, walletStore]);

  const onLoadFirstUtxo = useCallback(() => {
    const firstUtxo = walletStore.getMatureUtxos().at(0);

    if (!firstUtxo) {
      setFirstUtxo(null);
      return;
    }

    setFirstUtxo({
      amount: firstUtxo.amount,
      blockDaaScore: firstUtxo.blockDaaScore,
      toAddress: firstUtxo.address?.toString() ?? 'unknown',
      transactionId: firstUtxo.outpoint.transactionId,
    });
  }, [walletStore]);

  if (step === 0) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center">
        <p className="text-center">
          Spectre (mainnet) Receive Address:{' '}
          <code className="select-text block break-all px-4 2xl:px-0">{address?.toString()}</code>
        </p>

        <p>Mature Balance: {balance}</p>

        {!firstUtxo ? (
          <button onClick={onLoadFirstUtxo}>Load UTXO Details</button>
        ) : (
          <div className="mt-4 flex flex-col items-center">
            <h3 className="font-bold text-center">UTXO details</h3>
            <p className="text-center font-bold pt-2">
              Transaction Id:{' '}
              <code className="font-normal block break-all px-4 2xl:px-0">{firstUtxo.transactionId}</code>
            </p>
            <p className="text-center font-bold pt-2">
              Amount: <span className="font-normal">{sompiToSpectreString(firstUtxo.amount)}</span>
            </p>
            <p className="text-center font-bold pt-2">
              Block DAA Score: <span className="font-normal">{firstUtxo.blockDaaScore}</span>
            </p>
            <p className="text-center font-bold pt-2">
              Recipiant:
              <code className="font-normal block break-all px-4 2xl:px-0">{firstUtxo.toAddress}</code>
            </p>

            <a
              target="_blank"
              rel="noreferrer"
              href={`https://explorer-tn.spectre-network.org/txs/${firstUtxo.transactionId}`}
              className="mt-4 inline-block"
            >
              See my transaction on the Spectre Explorer
            </a>
          </div>
        )}
      </div>
    );
  }
};
