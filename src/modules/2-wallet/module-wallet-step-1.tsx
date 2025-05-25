import { FC, useCallback, useEffect, useState } from 'react';
import { useSpectreStore } from '../../core/spectre-store';
import { useWalletStore } from '../../core/wallet-store';
import { Mnemonic, Address, spectreToSompi, sompiToSpectreString } from 'spectre-wasm';

type ModuleWalletStep1Props = {};

type CreateWalletStepState =
  | {
      type: 'import';
      mnemonic?: string;
      error?: string;
    }
  | {
      type: 'confirmed';
      message: string;
    };

type UtxoInfo = {
  amount: bigint;
  toAddress: string;
  blockDaaScore: bigint;
  transactionId: string;
};

export const ModuleWalletStep1: FC<ModuleWalletStep1Props> = ({}) => {
  const balance = useWalletStore((s) => s.balance);
  const address = useWalletStore((s) => s.address);
  const sendTransaction = useWalletStore((s) => s.sendTransaction);
  const getMatureUtxos = useWalletStore((s) => s.getMatureUtxos);

  const walletStore = useWalletStore();

  const init = useSpectreStore((s) => s.init);
  const rpc = useSpectreStore((s) => s.spectreClientInstance);

  const [step, setStep] = useState(0);
  const [createWalletStep, setCreateWalletStep] = useState<CreateWalletStepState | null>(null);

  const [mnemonicPhrase, setMnemonicPhrase] = useState<string | null>(null);

  const [utxos, setUtxos] = useState<UtxoInfo[] | null | undefined>(undefined);

  const [password, setPassword] = useState('');

  const [destinationAddress, setDestinationAddress] = useState('');
  const [amount, setAmount] = useState('');
  const [sendPassword, setSendPassword] = useState('');
  const [sendError, setSendError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const loadUtxos = useCallback(() => {
    try {
      console.log('Loading UTXOs...');
      // Check if wallet is ready before accessing UTXOs
      if (!walletStore.unlockedWallet || !address) {
        console.log('Wallet not ready yet');
        return;
      }

      const matureUtxos = getMatureUtxos();
      console.log('UTXOs:', matureUtxos);

      if (!matureUtxos || matureUtxos.length === 0) {
        setUtxos(null);
        return;
      }

      const utxoInfoList = matureUtxos.map((utxo) => ({
        amount: utxo.amount,
        blockDaaScore: utxo.blockDaaScore,
        toAddress: utxo.address?.toString() ?? 'unknown',
        transactionId: utxo.outpoint.transactionId,
      }));

      // Sort UTXOs by blockDaaScore (highest first)
      utxoInfoList.sort((a, b) => Number(b.blockDaaScore) - Number(a.blockDaaScore));

      // Limit to 10 most recent UTXOs
      const recentUtxos = utxoInfoList.slice(0, 10);

      setUtxos(recentUtxos);
    } catch (error) {
      console.error('Error loading UTXOs:', error);
    }
  }, [getMatureUtxos, address, walletStore.unlockedWallet]);

  // Load UTXOs when wallet is properly started or when balance changes
  useEffect(() => {
    if (step === 1 && address && walletStore.unlockedWallet) {
      loadUtxos();
    }
  }, [step, address, walletStore.unlockedWallet, balance, loadUtxos]);

  const onCreateWallet = useCallback(async () => {
    if (password.length < 8) {
      alert('Password must be at least 8 characters long');
      return;
    }

    const mnemonicObj = Mnemonic.random(12);
    const phrase = mnemonicObj.phrase;

    setMnemonicPhrase(phrase);

    await walletStore.create(mnemonicObj, password);

    setCreateWalletStep({
      type: 'confirmed',
      message: 'Successfully created wallet, here is the mnemonic (seed phrase):',
    });
  }, [password, walletStore]);

  const onOpenWallet = useCallback(async () => {
    try {
      await walletStore.unlock(password);
    } catch (error) {
      console.error('Error unlocking wallet:', error);
      alert(`Failed to unlock wallet: ${(error as Error).message}`);
    }
  }, [walletStore, password]);

  const onImportWallet = useCallback(async () => {
    setCreateWalletStep({ type: 'import' });
  }, []);

  const onSubmitImport = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      const form = e.target as HTMLFormElement;
      const mnemonicInput = form.elements.namedItem('mnemonic') as HTMLTextAreaElement;
      const passwordInput = form.elements.namedItem('password') as HTMLInputElement;

      const mnemonicValue = mnemonicInput.value.trim();
      const passwordValue = passwordInput.value;

      if (!mnemonicValue) {
        setCreateWalletStep({
          type: 'import',
          error: 'Mnemonic phrase cannot be empty',
        });
        return;
      }

      if (passwordValue.length < 8) {
        setCreateWalletStep({
          type: 'import',
          error: 'Password must be at least 8 characters long',
        });
        return;
      }

      try {
        const mnemonicObj = new Mnemonic(mnemonicValue);

        await walletStore.create(mnemonicObj, passwordValue);

        setCreateWalletStep({
          type: 'confirmed',
          message: 'Successfully imported wallet',
        });
      } catch (error) {
        console.error('Import error:', error);
        setCreateWalletStep({
          type: 'import',
          error: (error as Error).message,
        });
      }
    },
    [walletStore]
  );

  const startWalletAndNavigate = useCallback(async () => {
    try {
      if (!rpc.connected) {
        await init();
      }

      setStep(step + 1);

      await walletStore.start(rpc, walletStore.unlockedWallet!);
      console.log('Wallet started successfully');

      // Try to load UTXOs only after wallet is successfully started
      loadUtxos();
    } catch (error) {
      console.error('Error starting wallet:', error);
    }
  }, [walletStore, rpc, step, init, loadUtxos]);

  const onResetClicked = useCallback(() => {
    walletStore.flush();
    setCreateWalletStep(null);
    setMnemonicPhrase(null);
    setStep(0);
    setPassword('');
  }, [walletStore]);

  const createTransaction = useCallback(
    async (e: React.FormEvent<HTMLFormElement>) => {
      e.preventDefault();
      try {
        setIsSending(true);
        setSendError(null);

        if (!destinationAddress) {
          setSendError('Destination address is required');
          setIsSending(false);
          return;
        }

        if (!amount) {
          setSendError('Amount is required');
          setIsSending(false);
          return;
        }

        if (!sendPassword) {
          setSendError('Password is required');
          setIsSending(false);
          return;
        }

        // Make sure the address is valid before proceeding
        let addressObj: Address;
        try {
          addressObj = new Address(destinationAddress);
        } catch (error) {
          console.error('Invalid address:', error);
          setSendError('Invalid destination address');
          setIsSending(false);
          return;
        }

        await sendTransaction(addressObj, spectreToSompi(amount) as bigint, sendPassword);

        // Reset form
        setDestinationAddress('');
        setAmount('');
        setSendPassword('');
      } catch (error) {
        console.error('Send error:', error);
        setSendError((error as Error).message);
      } finally {
        setIsSending(false);
      }
    },
    [destinationAddress, amount, sendPassword, sendTransaction]
  );

  if (step === 0) {
    if (createWalletStep) {
      return (
        <div className="flex flex-col w-100">
          <div className="self-end mb-2">
            <button onClick={onResetClicked} className="text-red-600 hover:text-red-800">
              Reset Wallet
            </button>
          </div>

          <div className="flex gap-4 items-center justify-center">
            {createWalletStep.type === 'import' ? (
              <form
                className="flex gap-4 flex-col items-center justify-center w-full max-w-2xl"
                onSubmit={onSubmitImport}
              >
                <div className="node-dashboard w-full">
                  <div className="dashboard-grid">
                    <div className="dashboard-section-header">IMPORT WALLET</div>

                    <div className="dashboard-item col-span-2 md:col-span-3">
                      <div className="item-label">Mnemonic Phrase</div>
                      <div className="item-value">
                        <textarea
                          name="mnemonic"
                          required
                          className="w-full bg-transparent border rounded p-2 focus:outline-none"
                          placeholder="Enter your 12 or 24 word mnemonic phrase"
                        />
                      </div>
                    </div>

                    <div className="dashboard-item col-span-2 md:col-span-3">
                      <div className="item-label">Wallet Password</div>
                      <div className="item-value">
                        <input
                          type="password"
                          name="password"
                          placeholder="Enter password (min 8 characters)"
                          className="w-full bg-transparent border-0 focus:outline-none"
                          minLength={8}
                          required
                        />
                      </div>
                    </div>
                  </div>
                </div>

                {createWalletStep.error && (
                  <div className="mt-2 text-red-500">
                    <p>{createWalletStep.error}</p>
                  </div>
                )}

                <button type="submit" className="mt-4">
                  Import Wallet
                </button>
              </form>
            ) : (
              <div className="flex flex-col gap-4 items-center justify-center w-full max-w-2xl">
                <div className="node-dashboard w-full">
                  <div className="dashboard-grid">
                    <div className="dashboard-section-header">WALLET CREATED</div>

                    <div className="dashboard-item col-span-2 md:col-span-3">
                      <div className="item-label">{createWalletStep.message}</div>
                      <div className="item-value smaller">
                        {mnemonicPhrase && (
                          <code className="select-text block break-all px-4 py-3 bg-gray-100 rounded-md w-full text-center">
                            {mnemonicPhrase}
                          </code>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <button onClick={startWalletAndNavigate} className="mt-4">
                  Next
                </button>
              </div>
            )}
          </div>
        </div>
      );
    }

    return (
      <div className="flex flex-col gap-4 items-center justify-center w-full">
        {!walletStore.doesExists ? (
          <div className="flex flex-col gap-4 items-center justify-center w-full max-w-2xl">
            <div className="node-dashboard w-full">
              <div className="dashboard-grid">
                <div className="dashboard-section-header">CREATE OR IMPORT WALLET</div>

                <div className="dashboard-item col-span-2 md:col-span-3">
                  <div className="item-label">Wallet Password</div>
                  <div className="item-value">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter password (min 8 characters)"
                      className="w-full bg-transparent border-0 focus:outline-none"
                      minLength={8}
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-center mt-4">
              <button onClick={onCreateWallet}>Create a Wallet</button>
              <p>OR</p>
              <button onClick={onImportWallet}>Import a Wallet</button>
            </div>
          </div>
        ) : walletStore.unlockedWallet !== null ? (
          <div className="flex gap-4 items-center justify-center">
            <button onClick={startWalletAndNavigate}>Show Wallet</button>
            <p>OR</p>
            <button onClick={onResetClicked} className="text-red-600 hover:text-red-800">
              Reset Wallet
            </button>
          </div>
        ) : (
          <div className="flex flex-col gap-4 items-center justify-center w-full max-w-2xl">
            <div className="node-dashboard w-full">
              <div className="dashboard-grid">
                <div className="dashboard-section-header">OPEN WALLET</div>

                <div className="dashboard-item col-span-2 md:col-span-3">
                  <div className="item-label">Wallet Password</div>
                  <div className="item-value">
                    <input
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Enter wallet password"
                      className="w-full bg-transparent border-0 focus:outline-none"
                    />
                  </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4 items-center mt-4">
              <button onClick={onOpenWallet}>Open the Wallet</button>
              <p>OR</p>
              <button onClick={onResetClicked} className="text-red-600 hover:text-red-800">
                Reset Wallet
              </button>
            </div>
          </div>
        )}
      </div>
    );
  }

  if (step === 1) {
    return (
      <div className="flex flex-col gap-4 items-center justify-center w-100">
        <div className="self-end mb-2">
          <button onClick={onResetClicked} className="text-red-600 hover:text-red-800">
            Reset Wallet
          </button>
        </div>

        {/* Wallet dashboard layout */}
        <div className="node-dashboard w-full max-w-2xl">
          <div className="dashboard-grid">
            <div className="dashboard-section-header">WALLET STATUS</div>

            <div className="dashboard-item col-span-2 md:col-span-3">
              <div className="item-label">Receive Address</div>
              <div className="item-value smaller select-text">{address?.toString() || 'Not available'}</div>
            </div>

            <div className="dashboard-item">
              <div className="item-label">Mature Balance</div>
              <div className="item-value">{balance}</div>
            </div>
          </div>
        </div>

        {/* Send section */}
        <form onSubmit={createTransaction} className="w-full max-w-2xl mt-4">
          <div className="node-dashboard w-full">
            <div className="dashboard-grid">
              <div className="dashboard-section-header">SEND COINS</div>

              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-label">Destination Address</div>
                <div className="item-value">
                  <input
                    type="text"
                    value={destinationAddress}
                    onChange={(e) => setDestinationAddress(e.target.value)}
                    className="w-full bg-transparent border-0 focus:outline-none"
                    placeholder="Enter destination address"
                    required
                  />
                </div>
              </div>

              <div className="dashboard-item">
                <div className="item-label">Amount</div>
                <div className="item-value">
                  <input
                    type="text"
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                    className="w-full bg-transparent border-0 focus:outline-none"
                    placeholder="0.0"
                    required
                  />
                </div>
              </div>

              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-label">Wallet Password</div>
                <div className="item-value">
                  <input
                    type="password"
                    value={sendPassword}
                    onChange={(e) => setSendPassword(e.target.value)}
                    className="w-full bg-transparent border-0 focus:outline-none"
                    placeholder="Enter your wallet password"
                    required
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Send button inside the form */}
          <div className="flex justify-center w-full">
            <button type="submit" disabled={isSending} className="mt-4">
              {isSending ? 'Sending...' : 'Send'}
            </button>
          </div>
        </form>

        {/* Error message */}
        {sendError && (
          <div className="mt-4 text-red-500">
            <p>Error: {sendError}</p>
          </div>
        )}

        {/* UTXOs section */}
        {utxos === undefined ? (
          <button onClick={loadUtxos} className="mt-4">
            Load UTXOs
          </button>
        ) : utxos === null || utxos.length === 0 ? (
          <div className="node-dashboard w-full max-w-2xl mt-4">
            <div className="dashboard-grid">
              <div className="dashboard-section-header">UTXO DETAILS</div>
              <div className="dashboard-item col-span-2 md:col-span-3">
                <div className="item-value text-center">No UTXOs available yet.</div>
              </div>
            </div>
          </div>
        ) : (
          <div className="node-dashboard w-full max-w-2xl mt-4">
            <div className="dashboard-grid">
              <div className="dashboard-section-header">UTXO DETAILS ({utxos.length} most recent)</div>

              {utxos.map((utxo, index) => (
                <div key={`${utxo.transactionId}-${index}`} className="col-span-2 md:col-span-3">
                  <div className="dashboard-item mb-1">
                    <div className="item-label">Transaction ID</div>
                    <div className="item-value smaller">
                      <a
                        href={`https://explorer-tn.spectre-network.org/txs/${utxo.transactionId}`}
                        target="_blank"
                        rel="noreferrer"
                        className="text-blue-600 hover:underline"
                      >
                        {utxo.transactionId}
                      </a>
                    </div>
                  </div>

                  <div className="dashboard-item mb-1">
                    <div className="item-label">Amount</div>
                    <div className="item-value">{sompiToSpectreString(utxo.amount)}</div>
                  </div>

                  <div className="dashboard-item mb-4">
                    <div className="item-label">Block DAA Score</div>
                    <div className="item-value">{utxo.blockDaaScore.toString()}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    );
  }
};
