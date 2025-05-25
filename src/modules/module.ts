import ModuleNetwork from "./1-network/ModuleNetwork";
import ModuleWallet from "./2-wallet/ModuleWallet";
import ModuleTransaction from "./3-transaction/ModuleTransaction";
import ModuleUtxo from "./4-utxo/ModuleUtxo";
import EmptyModule from "./empty-module";

export type Module = {
  title: string;
  description: string;
  component: React.FC;
  path: string;
};

export const modules: Module[] = [
  {
    title: "Network Dashboard",
    description:
      "WIP",
    component:  ModuleNetwork,
    path: "network",
  },
  {
    title: "Wallet",
    description:
      "WIP",
    component: ModuleWallet,
    path: "wallet",
  },
  {
    title: "Explorer",
    description:
      "WIP",
    component: ModuleTransaction,
    path: "transaction",
  },
  {
    title: "WIP",
    description:
      "WIP",
    component: ModuleUtxo,
    path: "utxo",
  },
];
