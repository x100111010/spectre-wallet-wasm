# A new web-wallet for Spectre which uses [spectre-wasm](https://github.com/spectre-project/rusty-spectre/tree/main/wasm)


# Done

- set a custom password
- tx generator (like wasm\examples\nodejs\javascript\transactions\generator.js): consolidates utxos to create a tx
- (pie)chart network state using block-added notifications


## TODOS

- address discovery (receive & change address)
- accounts
- sweep/compound
- code cleanup/refactor
- better Ui?
- add more charts/network info
- something like KGI? (can also be done with block-added)
- set a custom node/wss url
- explorer should return a list of utxos for a given address


## Running Locally

### Prerequisites:

- Ensure Node.js is installed locally.

### Steps:

1. Download the WASM build and extract it to the existing folder `./wasm` from the [spectre-wasm](https://github.com/spectre-project/rusty-spectre/tree/main/wasm), or build it from the source code there.
2. Run `npm install`
3. Run `npm start`


## Credits

- **IzioDev** for the initial wallet implementation
