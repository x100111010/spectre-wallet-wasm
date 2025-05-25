import {
  Address,
  Generator,
  spectreToSompi,
  sompiToSpectreString,
  PaymentOutput,
  PendingTransaction,
  UtxoContext,
  UtxoProcessor,
  UtxoProcessorEvent,
} from "spectre-wasm";
import { UnlockedWallet, WalletStorage } from "../utils/wallet-storage";
import EventEmitter from "eventemitter3";
import { SpectreClient } from "./spectre-client";

// stricly typed events
export type AccountServiceEvents = {
  balance: (balance: string | number) => void;
  ready: () => void;
};

type CreateTransactionArgs = {
  address: Address;
  amount: bigint;
  payload: string;
};

type SendMessageArgs = {
  toAddress: Address;
  message: string;
  password: string;
};

export class AccountService extends EventEmitter<AccountServiceEvents> {
  processor: UtxoProcessor;
  context: UtxoContext;
  networkId: string;

  // only populated when started
  isStarted: boolean = false;
  receiveAddress: Address | null = null;
  changeAddress: Address | null = null;

  constructor(
    private readonly rpcClient: SpectreClient,
    private readonly unlockedWallet: UnlockedWallet
  ) {
    super();

    if (!rpcClient.rpc) {
      throw new Error("RPC client is not initialized");
    }

    this.networkId = rpcClient.networkId;

    this.processor = new UtxoProcessor({
      networkId: this.networkId,
      rpc: rpcClient.rpc,
    });
    this.context = new UtxoContext({ processor: this.processor });
  }

  async start() {
    this.receiveAddress = this.unlockedWallet.publicKeyGenerator.receiveAddress(
      this.networkId,
      0
    );

    this.changeAddress = this.unlockedWallet.publicKeyGenerator.changeAddress(
      this.networkId,
      0
    );

    this.processor.addEventListener(
      "utxo-proc-start",
      this._onProcessorStart.bind(this)
    );
    this.processor.addEventListener(
      "balance",
      this._onBalanceChanged.bind(this)
    );

    await this.processor.start();

    this.isStarted = true;
  }

  async stop() {
    this.processor.removeEventListener(
      "utxo-proc-start",
      this._onProcessorStart.bind(this)
    );

    // TODO: fix this
    // this.processor.removeEventListener(
    //   "balance",
    //   this._onBalanceChanged.bind(this)
    // );

    this.processor.stop();
  }

  private async _onProcessorStart() {
    await this.context.trackAddresses([
      this.receiveAddress!,
      this.changeAddress!,
    ]);

    const initialBalance = await this.context.balance;

    const balanceValue = initialBalance?.mature 
      ? sompiToSpectreString(initialBalance.mature)
      : "0.00000000";
    
    this.emit("balance", balanceValue);
    this.emit("ready");
  }

  private async _onBalanceChanged(event: UtxoProcessorEvent<"balance">) {
    const balanceValue = event.data.balance?.mature
      ? sompiToSpectreString(event.data.balance.mature)
      : "0.00000000";
    
    this.emit("balance", balanceValue);
  }

  public async createTransaction(
    transaction: CreateTransactionArgs,
    password: string
  ) {
    if (!this.isStarted || !this.rpcClient.rpc) {
      throw new Error("Account service is not started");
    }

    const privateKeyGenerator = WalletStorage.getPrivateKeyGenerator(
      this.unlockedWallet,
      password
    );

    const paymentOutput = new PaymentOutput(
      transaction.address,
      transaction.amount
    );

    const generator = new Generator({
      changeAddress: this.changeAddress!,
      entries: this.context,
      outputs: [paymentOutput],
      payload: transaction.payload,
      priorityFee: BigInt(0),
      networkId: this.rpcClient.networkId,
    });

    try {
      let pendingTransaction: PendingTransaction | null;
      let txId: string | null = null;
      
      // process all transactions like wasm\examples\nodejs\javascript\transactions\generator.js
      while (pendingTransaction = await generator.next()) {
        const receiveAddress = this.receiveAddress!.toString();

        const privateKeys = pendingTransaction
          .addresses()
          .map((a: Address) =>
            a.toString() === receiveAddress
              ? privateKeyGenerator.receiveKey(0)
              : privateKeyGenerator.changeKey(0)
          );

        pendingTransaction.sign(privateKeys);
        
        // Submit and get transaction ID
        const currentTxId = await pendingTransaction.submit(this.rpcClient.rpc);
        
        // Keep the last transaction ID
        txId = currentTxId;
        console.log("Transaction submitted:", currentTxId);
      }

      // Return the last transaction ID (or throw error if none were created)
      if (!txId) {
        throw new Error("No transactions were generated");
      }
      
      return txId;
    } catch (error) {
      console.error(error);
      throw error;
    }
  }

  public async estimateTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this._getGeneratorForTransaction(transaction).estimate();
  }

  public getMatureUtxos() {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return this.context.getMatureRange(0, this.context.matureLength);
  }

  private _getGeneratorForTransaction(transaction: CreateTransactionArgs) {
    if (!this.isStarted) {
      throw new Error("Account service is not started");
    }

    return new Generator({
      changeAddress: this.changeAddress!,
      entries: this.context,
      outputs: new PaymentOutput(transaction.address, transaction.amount),
      payload: transaction.payload,
    });
  }
}
