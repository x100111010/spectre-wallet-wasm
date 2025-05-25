import { RpcClient, IUtxosChanged, Encoding, IVirtualDaaScoreChanged, ISinkBlueScoreChanged } from "spectre-wasm";
import { unknownErrorToErrorLike } from "../utils/errors";

// Create a simple client for API requests
export class SpectreClient {
  options: {
    debug: boolean;
    retryDelay: number;
    maxRetries: number;
  };

  rpc: RpcClient | null;
  networkId: string;
  connected: boolean;
  retryCount: number;

  utxoNotificationCallback?: (notification: IUtxosChanged) => unknown;
  utxoNotificationSubscribeAddresses: string[] = [];
  historyOfEmittedTxIdUtxoChanges: string[] = [];

  daaScoreNotificationCallback?: (notification: IVirtualDaaScoreChanged) => unknown;
  daaScoreSubscribed: boolean = false;
  lastEmittedDaaScore: number | null = null;

  blockAddedNotificationCallback?: (notification: any) => unknown;
  blockAddedSubscribed: boolean = false;
  historyOfEmittedBlockHashes: string[] = [];

  blueScoreNotificationCallback?: (notification: ISinkBlueScoreChanged) => unknown;
  blueScoreSubscribed: boolean = false;
  lastEmittedBlueScore: number | null = null;

  constructor() {
    this.options = {
      debug: true,
      retryDelay: 2000,
      maxRetries: 3,
    };

    this.rpc = null;
    this.networkId = "devnet"; // Fixed to "devnet"
    this.connected = false;
    this.retryCount = 0;
  }

  // Log helper function
  log(message: string, level = "log") {
    if (this.options.debug) {
      // @TODO: use a proper logging method
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      console[level](`[SpectreClient] ${message}`);
    }
  }

  // Connect to a node using the resolver
  async connect(): Promise<unknown> {
    if (this.retryCount >= this.options.maxRetries) {
      throw new Error(
        `Failed to connect after ${this.options.maxRetries} attempts`
      );
    }

    try {
      this.log(`Initializing connection for network: ${this.networkId}`);

      // Fixed node address
      const nodeAddress = "127.0.0.1:19610";
      this.log(`Using fixed node address: ${nodeAddress}`);
      
      // Create RPC client with direct URL configuration
      this.rpc = new RpcClient({
        networkId: this.networkId,
        encoding: Encoding.Borsh,
        url: nodeAddress  // Use the fixed address directly
      });

      // Connect to the network
      await this.rpc.connect();
      this.connected = true;
      this.log(`Connected to ${this.rpc.url}`);

      return this;
    } catch (error) {
      this.log(
        `Connection attempt failed: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      this.retryCount++;

      if (this.retryCount < this.options.maxRetries) {
        this.log(`Retrying in ${this.options.retryDelay}ms...`);
        await new Promise((resolve) =>
          setTimeout(resolve, this.options.retryDelay)
        );
        return this.connect();
      }

      throw error;
    }
  }

  // Disconnect from the node
  async disconnect() {
    if (this.rpc && this.connected) {
      // Clean up all subscriptions
      try {
        await this.unsubscribeFromUtxoChanges();
        await this.unsubscribeFromDaaScoreChanges();
        await this.unsubscribeFromBlueScoreChanges();
        await this.unsubscribeFromBlockAdded();
      } catch (error) {
        this.log(
          `Error unsubscribing during disconnect: ${unknownErrorToErrorLike(error)}`,
          "warn"
        );
      }
      
      await this.rpc.disconnect();
      this.connected = false;
      this.log("Disconnected from node");
    }
  }

  async subscribeToUtxoChanges(
    addresses: string[],
    callback: (notification: IUtxosChanged) => unknown
  ) {
    try {
      if (!this.rpc || !this.connected) {
        throw new Error("Not connected to network");
      }

      if (this.utxoNotificationCallback) {
        this.rpc.removeEventListener(
          "utxos-changed",
          this.utxoNotificationCallback
        );
        this.rpc.unsubscribeUtxosChanged(
          this.utxoNotificationSubscribeAddresses
        );
        this.log("Removed existing UTXO change listener");
      }

      this.log(`Subscribing to UTXO changes for addresses: ${addresses}`);

      const boundCallback = callback.bind(this);

      const wrappedWithFilter = (notification: IUtxosChanged) => {
        const transactionIds = notification.data.added?.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          (utxo: any) => utxo?.outpoint?.transactionId
        );

        const notEmittedTxIds = transactionIds.filter(
          (txId: string) =>
            this.historyOfEmittedTxIdUtxoChanges.findIndex(
              (item) => item === txId
            ) === -1
        );

        if (notEmittedTxIds.length > 0) {
          this.log(
            `Emitting UTXO change notification for txids: ${notEmittedTxIds}`
          );
          this.historyOfEmittedTxIdUtxoChanges.push(...notEmittedTxIds);

          boundCallback(notification);
        }
      };

      this.utxoNotificationCallback = wrappedWithFilter.bind(this);
      this.utxoNotificationSubscribeAddresses = addresses;

      this.rpc.addEventListener("utxos-changed", this.utxoNotificationCallback);

      this.rpc.subscribeUtxosChanged(this.utxoNotificationSubscribeAddresses);

      this.log("Successfully subscribed to UTXO changes");
    } catch (error) {
      this.log(
        `Error subscribing to UTXO changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      throw error;
    }
  }

  async unsubscribeFromUtxoChanges() {
    try {
      if (!this.rpc || !this.connected) {
        return;
      }

      if (this.utxoNotificationCallback) {
        this.rpc.removeEventListener(
          "utxos-changed",
          this.utxoNotificationCallback
        );
        
        if (this.utxoNotificationSubscribeAddresses.length > 0) {
          this.rpc.unsubscribeUtxosChanged(
            this.utxoNotificationSubscribeAddresses
          );
        }
        
        this.utxoNotificationCallback = undefined;
        this.utxoNotificationSubscribeAddresses = [];
        this.historyOfEmittedTxIdUtxoChanges = [];
        
        this.log("Unsubscribed from UTXO changes");
      }
    } catch (error) {
      this.log(
        `Error unsubscribing from UTXO changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
    }
  }

  async subscribeToDaaScoreChanges(
    callback: (notification: IVirtualDaaScoreChanged) => unknown
  ) {
    try {
      if (!this.rpc || !this.connected) {
        throw new Error("Not connected to network");
      }

      if (this.daaScoreNotificationCallback) {
        this.rpc.removeEventListener(
          "virtual-daa-score-changed",
          this.daaScoreNotificationCallback
        );
        if (this.daaScoreSubscribed) {
          await this.rpc.unsubscribeVirtualDaaScoreChanged();
        }
        this.log("Removed existing DAA score change listener");
      }

      this.log("Subscribing to DAA score changes");

      const boundCallback = callback.bind(this);

      const wrappedWithFilter = (notification: IVirtualDaaScoreChanged) => {
        const newDaaScore = notification.data.virtualDaaScore;

        if (this.lastEmittedDaaScore === null || newDaaScore !== this.lastEmittedDaaScore) {
          this.log(`Emitting DAA score change notification: ${newDaaScore}`);
          this.lastEmittedDaaScore = newDaaScore;

          boundCallback(notification);
        }
      };

      this.daaScoreNotificationCallback = wrappedWithFilter.bind(this);

      this.rpc.addEventListener(
        "virtual-daa-score-changed", 
        this.daaScoreNotificationCallback
      );

      await this.rpc.subscribeVirtualDaaScoreChanged();
      this.daaScoreSubscribed = true;

      this.log("Successfully subscribed to DAA score changes");
    } catch (error) {
      this.log(
        `Error subscribing to DAA score changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      throw error;
    }
  }

  async unsubscribeFromDaaScoreChanges() {
    try {
      if (!this.rpc || !this.connected) {
        return;
      }

      if (this.daaScoreNotificationCallback) {
        this.rpc.removeEventListener(
          "virtual-daa-score-changed",
          this.daaScoreNotificationCallback
        );
        
        if (this.daaScoreSubscribed) {
          await this.rpc.unsubscribeVirtualDaaScoreChanged();
          this.daaScoreSubscribed = false;
        }
        
        this.daaScoreNotificationCallback = undefined;
        this.lastEmittedDaaScore = null;
        
        this.log("Unsubscribed from DAA score changes");
      }
    } catch (error) {
      this.log(
        `Error unsubscribing from DAA score changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
    }
  }

  async subscribeToBlueScoreChanges(
    callback: (notification: ISinkBlueScoreChanged) => unknown
  ) {
    try {
      if (!this.rpc || !this.connected) {
        throw new Error("Not connected to network");
      }

      if (this.blueScoreNotificationCallback) {
        this.rpc.removeEventListener(
          "sink-blue-score-changed",
          this.blueScoreNotificationCallback
        );
        if (this.blueScoreSubscribed) {
          await this.rpc.unsubscribeSinkBlueScoreChanged();
        }
        this.log("Removed existing Blue score change listener");
      }

      this.log("Subscribing to Sink Blue score changes");

      const boundCallback = callback.bind(this);

      const wrappedWithFilter = (notification: ISinkBlueScoreChanged) => {
        const newBlueScore = notification.data.sinkBlueScore;

        if (this.lastEmittedBlueScore === null || newBlueScore !== this.lastEmittedBlueScore) {
          this.log(`Emitting Blue score change notification: ${newBlueScore}`);
          this.lastEmittedBlueScore = newBlueScore;

          boundCallback(notification);
        }
      };

      this.blueScoreNotificationCallback = wrappedWithFilter.bind(this);

      this.rpc.addEventListener(
        "sink-blue-score-changed", 
        this.blueScoreNotificationCallback
      );

      await this.rpc.subscribeSinkBlueScoreChanged();
      this.blueScoreSubscribed = true;

      this.log("Successfully subscribed to Sink Blue score changes");
    } catch (error) {
      this.log(
        `Error subscribing to Sink Blue score changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      throw error;
    }
  }

  async unsubscribeFromBlueScoreChanges() {
    try {
      if (!this.rpc || !this.connected) {
        return;
      }

      if (this.blueScoreNotificationCallback) {
        this.rpc.removeEventListener(
          "sink-blue-score-changed",
          this.blueScoreNotificationCallback
        );
        
        if (this.blueScoreSubscribed) {
          await this.rpc.unsubscribeSinkBlueScoreChanged();
          this.blueScoreSubscribed = false;
        }
        
        this.blueScoreNotificationCallback = undefined;
        this.lastEmittedBlueScore = null;
        
        this.log("Unsubscribed from Blue score changes");
      }
    } catch (error) {
      this.log(
        `Error unsubscribing from Blue score changes: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
    }
  }

  // any because there doesnt seem to be a direct interface for sub to new blocks
  async subscribeToBlockAdded(
    callback: (notification: any) => unknown
  ) {
    try {
      if (!this.rpc || !this.connected) {
        throw new Error("Not connected to network");
      }

      if (this.blockAddedNotificationCallback) {
        this.rpc.removeEventListener(
          "block-added",
          this.blockAddedNotificationCallback
        );
        if (this.blockAddedSubscribed) {
          await this.rpc.unsubscribeBlockAdded();
        }
        this.log("Removed existing block added listener");
      }

      this.log("Subscribing to block added events");

      const boundCallback = callback.bind(this);

      const wrappedWithFilter = (notification: any) => {
        // Remove parentsByLevel to reduce data output, similar to the example
        if (notification.data.block?.header?.parentsByLevel) {
          delete notification.data.block.header.parentsByLevel;
        }

        // Get block hash for filtering
        const blockHash = notification.data.block?.header?.hash;
        
        if (blockHash && this.historyOfEmittedBlockHashes.indexOf(blockHash) === -1) {
          this.log(`Emitting block added notification for hash: ${blockHash}`);
          this.historyOfEmittedBlockHashes.push(blockHash);

          boundCallback(notification);
        }
      };

      this.blockAddedNotificationCallback = wrappedWithFilter.bind(this);

      this.rpc.addEventListener(
        "block-added", 
        this.blockAddedNotificationCallback
      );

      await this.rpc.subscribeBlockAdded();
      this.blockAddedSubscribed = true;

      this.log("Successfully subscribed to block added events");
    } catch (error) {
      this.log(
        `Error subscribing to block added events: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
      throw error;
    }
  }

  async unsubscribeFromBlockAdded() {
    try {
      if (!this.rpc || !this.connected) {
        return;
      }

      if (this.blockAddedNotificationCallback) {
        this.rpc.removeEventListener(
          "block-added",
          this.blockAddedNotificationCallback
        );
        
        if (this.blockAddedSubscribed) {
          await this.rpc.unsubscribeBlockAdded();
          this.blockAddedSubscribed = false;
        }
        
        this.blockAddedNotificationCallback = undefined;
        this.historyOfEmittedBlockHashes = [];
        
        this.log("Unsubscribed from block added events");
      }
    } catch (error) {
      this.log(
        `Error unsubscribing from block added events: ${unknownErrorToErrorLike(error)}`,
        "error"
      );
    }
  }
}
